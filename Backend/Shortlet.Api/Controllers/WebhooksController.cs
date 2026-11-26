using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shortlet.Api.Helpers;
using Shortlet.Api.Services;
using Shortlet.Core.Entities;
using Shortlet.Core.Interfaces;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Controllers
{
    /// <summary>
    /// Paystack events: charge.success (guest payments), transfer.* (host withdrawals) and refund.* (refunds).
    /// Configure https://&lt;api&gt;/api/Webhooks/paystack as the webhook URL in the Paystack dashboard.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class WebhooksController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly IEmailQueue _emailQueue;
        private readonly BookingFinanceService _finance;
        private readonly Notifier _notifier;
        private readonly ILogger<WebhooksController> _logger;

        public WebhooksController(AppDbContext context, IConfiguration config, IEmailQueue emailQueue, BookingFinanceService finance, ILogger<WebhooksController> logger, Notifier notifier)
        {
            _context = context;
            _config = config;
            _emailQueue = emailQueue;
            _finance = finance;
            _notifier = notifier;
            _logger = logger;
        }

        [HttpPost("paystack")]
        public async Task<IActionResult> PaystackWebhook()
        {
            var secretKey = _config["Paystack:SecretKey"];
            if (string.IsNullOrEmpty(secretKey))
            {
                _logger.LogError("Paystack webhook received but Paystack:SecretKey is not configured.");
                return StatusCode(500);
            }

            using var reader = new StreamReader(Request.Body);
            var body = await reader.ReadToEndAsync();

            var signature = Request.Headers["x-paystack-signature"].ToString();
            if (string.IsNullOrEmpty(signature)) return BadRequest("No signature found");
            if (!SignatureMatches(body, secretKey, signature)) return Unauthorized("Invalid signature");

            try
            {
                using var doc = JsonDocument.Parse(body);
                var payload = doc.RootElement;
                var eventName = payload.GetProperty("event").GetString() ?? string.Empty;
                var data = payload.GetProperty("data");

                if (eventName == "charge.success") await HandleChargeAsync(data);
                else if (eventName.StartsWith("transfer.")) await HandleTransferAsync(eventName, data);
                else if (eventName.StartsWith("refund.")) await HandleRefundAsync(eventName, data);

                return Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Paystack webhook processing failed");
                return StatusCode(500); // Paystack will retry
            }
        }

        // ------------------------------------------------------------------
        // charge.success
        // ------------------------------------------------------------------
        private async Task HandleChargeAsync(JsonElement data)
        {
            var reference = data.GetProperty("reference").GetString() ?? string.Empty;
            var amountPaidKobo = data.TryGetProperty("amount", out var amt) ? amt.GetInt64() : 0;

            if (reference.StartsWith("SPLIT", StringComparison.Ordinal))
                await HandleSplitShareAsync(reference, amountPaidKobo);
            else if (Guid.TryParse(reference, out var bookingId))
                await HandleSoloPaymentAsync(bookingId, reference, amountPaidKobo);
            else
                _logger.LogWarning("charge.success for unknown reference {Reference}", reference);
        }

        private async Task HandleSplitShareAsync(string reference, long amountPaidKobo)
        {
            Booking? completedBooking = null;
            SplitShare? share = null;
            var refundLateShare = false;

            await using (var tx = await _context.Database.BeginTransactionAsync())
            {
                if (BookingRules.TryParseSplitReference(reference, out var shareId))
                {
                    await WalletLedger.LockShareAsync(_context, shareId);
                    share = await _context.SplitShares.Include(s => s.SplitGroup).FirstOrDefaultAsync(s => s.Id == shareId);
                }
                share ??= await _context.SplitShares.Include(s => s.SplitGroup).FirstOrDefaultAsync(s => s.PaymentReference == reference);

                if (share == null) { _logger.LogWarning("Split payment {Reference} does not match any share.", reference); return; }
                if (share.Status == "Paid") return; // duplicate delivery
                if (amountPaidKobo < ToKobo(share.Amount))
                {
                    _logger.LogWarning("Split payment {Reference} underpaid: {Paid} kobo for {Expected}.", reference, amountPaidKobo, ToKobo(share.Amount));
                    return;
                }

                // Lock the booking so two friends paying at the same moment can't both miss "fully funded".
                await WalletLedger.LockBookingAsync(_context, share.SplitGroup.BookingId);
                await _context.Entry(share.SplitGroup).ReloadAsync();

                share.Status = "Paid";
                share.PaymentReference = reference; // the reference that actually paid (needed for refunds)

                if (share.SplitGroup.Status != "Pending")
                {
                    // Paid after the group expired or the host declined: give this friend their money back.
                    refundLateShare = true;
                }
                else
                {
                    share.SplitGroup.PaidShares += 1;
                    _logger.LogInformation("Split share paid ({Paid}/{Total}) for group {Group}.", share.SplitGroup.PaidShares, share.SplitGroup.TotalShares, share.SplitGroupId);
                    if (share.SplitGroup.PaidShares >= share.SplitGroup.TotalShares)
                    {
                        share.SplitGroup.Status = "Completed";
                        completedBooking = await _context.Bookings.Include(b => b.Property).Include(b => b.Guest)
                            .FirstOrDefaultAsync(b => b.Id == share.SplitGroup.BookingId);
                    }
                }
                await _context.SaveChangesAsync();
                await tx.CommitAsync();
            }

            if (refundLateShare)
            {
                _logger.LogWarning("Share {Reference} paid after its group closed; refunding.", reference);
                await _finance.RefundOnceAsync(share.SplitGroup.BookingId, reference, share.Amount, partial: false,
                    BookingFinanceService.PurposeBooking, "Group booking was no longer open");
                return;
            }

            if (completedBooking != null) await ConfirmPaymentAsync(completedBooking);
        }

        private async Task HandleSoloPaymentAsync(Guid bookingId, string reference, long amountPaidKobo)
        {
            var booking = await _context.Bookings.Include(b => b.Property).Include(b => b.Guest).FirstOrDefaultAsync(b => b.Id == bookingId);
            if (booking == null) { _logger.LogWarning("Payment for unknown booking {BookingId}", bookingId); return; }

            if (amountPaidKobo < ToKobo(booking.TotalPrice))
            {
                _logger.LogWarning("Booking {BookingId} underpaid: {Paid} kobo for {Expected}.", bookingId, amountPaidKobo, ToKobo(booking.TotalPrice));
                return;
            }

            if (booking.Status is "pending" or "failed")
            {
                await ConfirmPaymentAsync(booking);
            }
            else if (booking.Status is "rejected" or "cancelled" or "expired")
            {
                // The guest paid for a booking that's no longer open. Refund it.
                await _finance.RefundOnceAsync(booking.Id, reference, booking.TotalPrice, partial: false,
                    BookingFinanceService.PurposeBooking, "Booking was no longer open");
            }
            // paid / confirmed / completed: duplicate delivery, nothing to do
        }

        /// <summary>
        /// Marks a fully-funded booking as paid and credits the host, unless its dates were taken while the
        /// guest was paying (e.g. they paid after the 30-minute hold). In that case it is cancelled and refunded.
        /// </summary>
        private async Task ConfirmPaymentAsync(Booking booking)
        {
            Booking? conflict;
            await using (var tx = await _context.Database.BeginTransactionAsync())
            {
                await WalletLedger.LockBookingAsync(_context, booking.Id);
                await _context.Entry(booking).ReloadAsync();
                if (booking.Status is not ("pending" or "split_pending" or "failed")) return; // handled by a concurrent delivery

                conflict = await _context.Bookings
                    .Where(b => b.Id != booking.Id && b.PropertyId == booking.PropertyId &&
                                b.CheckIn < booking.CheckOut && b.CheckOut > booking.CheckIn &&
                                (b.Status == "paid" || b.Status == "confirmed" || b.Status == "completed"))
                    .FirstOrDefaultAsync();

                // Dates imported from Airbnb / Booking.com while the guest was paying also count (prevents double bookings).
                var importedBlock = conflict == null && await BookingRules.BlocksOverlapping(_context, booking.CheckIn, booking.CheckOut)
                    .AnyAsync(c => c.PropertyId == booking.PropertyId && c.Source == "feed");
                if (importedBlock) conflict = booking; // any non-null value marks the conflict

                if (conflict == null)
                {
                    booking.Status = "paid";
                    if (booking.CautionFeeAmount > 0) booking.CautionFeeStatus = "Held";

                    decimal addOnsTotal = await _context.BookingAddOns.Where(a => a.BookingId == booking.Id).SumAsync(a => a.Price);
                    // Room + 5% fee = total − caution − add-ons. The host keeps the room rate and 100% of add-ons.
                    decimal roomWithFee = booking.TotalPrice - booking.CautionFeeAmount - addOnsTotal;
                    decimal hostEarnings = Math.Round(roomWithFee / (1 + BookingRules.PlatformFeeRate) + addOnsTotal, 2);

                    var wallet = await WalletLedger.LockWalletAsync(_context, booking.Property.HostId);
                    wallet.Balance += hostEarnings;
                    wallet.UpdatedAt = DateTime.UtcNow;
                    _context.Transactions.Add(new Transaction
                    {
                        WalletId = wallet.Id,
                        Amount = hostEarnings,
                        Type = "Credit",
                        Description = $"Booking: {booking.Property.Title} ({booking.CheckIn:dd MMM} – {booking.CheckOut:dd MMM})",
                        Reference = booking.Id.ToString()
                    });
                    await _context.SaveChangesAsync();
                    await tx.CommitAsync();
                    _logger.LogInformation("Booking {BookingId} paid. Host credited ₦{Amount:N2}.", booking.Id, hostEarnings);
                }
                else
                {
                    await tx.CommitAsync();
                }
            }

            if (conflict != null)
            {
                _logger.LogWarning("Booking {BookingId} was paid after its dates were taken by {Other}; cancelling and refunding.", booking.Id, conflict.Id);
                // For a solo booking the payment isn't recorded as "paid" yet, so pass it explicitly.
                List<(string, decimal)>? payments = booking.Status == "split_pending" ? null : new() { (booking.PaymentReference, booking.TotalPrice) };
                await _finance.CancelAndRefundAsync(booking.Id, "cancelled", "Dates were booked by someone else",
                    $"Sorry, someone else booked {booking.Property.Title} for those dates while your payment was processing.", payments);
                return;
            }

            await _emailQueue.QueueEmailAsync(new EmailMessagePayload
            {
                ToEmail = booking.Guest.Email,
                Subject = $"Payment received: {booking.Property.Title}",
                Body = $"<p>Hi {System.Net.WebUtility.HtmlEncode(booking.Guest.Name)},</p>" +
                       $"<p>We've received your payment for <strong>{System.Net.WebUtility.HtmlEncode(booking.Property.Title)}</strong> " +
                       $"({booking.CheckIn:dd MMM yyyy} – {booking.CheckOut:dd MMM yyyy}). " +
                       "Your host will confirm shortly and you'll receive your check-in code by email.</p>"
            });

            // Tell the host straight away: they need to accept before check-in.
            await _notifier.NotifyAsync(booking.Property.HostId, "New booking request 🔔",
                $"{booking.Guest.Name} paid for {booking.Property.Title} ({booking.CheckIn:dd MMM}–{booking.CheckOut:dd MMM}). Accept or decline it.",
                "/dashboard");
            Shortlet.Api.Controllers.PropertiesController.InvalidatePublicCache(); // dates are now taken
        }

        // ------------------------------------------------------------------
        // transfer.success / transfer.failed / transfer.reversed
        // ------------------------------------------------------------------
        private async Task HandleTransferAsync(string eventName, JsonElement data)
        {
            var reference = data.TryGetProperty("reference", out var r) ? r.GetString() : null;
            if (string.IsNullOrEmpty(reference)) return;
            var status = eventName["transfer.".Length..]; // success | failed | reversed
            await _finance.FinalizePayoutAsync(reference, status);
        }

        // ------------------------------------------------------------------
        // refund.processed / refund.failed (refund.pending / refund.processing are informational)
        // ------------------------------------------------------------------
        private async Task HandleRefundAsync(string eventName, JsonElement data)
        {
            var newStatus = eventName switch { "refund.processed" => "Processed", "refund.failed" => "Failed", _ => null };
            if (newStatus == null) return;

            string? reference = null;
            if (data.TryGetProperty("transaction_reference", out var tr)) reference = tr.GetString();
            else if (data.TryGetProperty("transaction", out var t) && t.ValueKind == JsonValueKind.Object && t.TryGetProperty("reference", out var tref)) reference = tref.GetString();
            if (string.IsNullOrEmpty(reference)) { _logger.LogWarning("{Event} without a transaction reference", eventName); return; }

            var refunds = await _context.Refunds.Where(x => x.TransactionReference == reference && x.Status == "Processing").ToListAsync();
            foreach (var refund in refunds)
            {
                refund.Status = newStatus;
                refund.UpdatedAt = DateTime.UtcNow;
                if (newStatus == "Failed") refund.FailureReason = "Paystack reported the refund as failed";
            }
            await _context.SaveChangesAsync();
            if (newStatus == "Failed") _logger.LogError("Paystack reported a failed refund on {Reference}; it will be retried.", reference);
        }

        private static long ToKobo(decimal naira) => (long)Math.Round(naira * 100, MidpointRounding.AwayFromZero);

        private static bool SignatureMatches(string body, string key, string signatureHex)
        {
            using var hmac = new HMACSHA512(Encoding.UTF8.GetBytes(key));
            var expected = hmac.ComputeHash(Encoding.UTF8.GetBytes(body));
            byte[] provided;
            try { provided = Convert.FromHexString(signatureHex); }
            catch (FormatException) { return false; }
            return CryptographicOperations.FixedTimeEquals(expected, provided);
        }
    }
}
