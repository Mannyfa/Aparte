using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shortlet.Api.Helpers;
using Shortlet.Core.Entities;
using Shortlet.Core.Interfaces;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WebhooksController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly IEmailQueue _emailQueue;
        private readonly ILogger<WebhooksController> _logger;

        public WebhooksController(AppDbContext context, IConfiguration config, IEmailQueue emailQueue, ILogger<WebhooksController> logger)
        {
            _context = context;
            _config = config;
            _emailQueue = emailQueue;
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
                if (payload.GetProperty("event").GetString() != "charge.success") return Ok();

                var data = payload.GetProperty("data");
                var reference = data.GetProperty("reference").GetString() ?? string.Empty;
                var amountPaidKobo = data.TryGetProperty("amount", out var amt) ? amt.GetInt64() : 0;

                await using var tx = await _context.Database.BeginTransactionAsync();

                Booking? bookingToProcess = null;

                // ---------------- BRANCH 1: APARTEY SPLIT (fractional payment) ----------------
                if (reference.StartsWith("SPLIT", StringComparison.Ordinal))
                {
                    SplitShare? share = null;
                    if (BookingRules.TryParseSplitReference(reference, out var shareId))
                    {
                        await WalletLedger.LockShareAsync(_context, shareId);
                        share = await _context.SplitShares.Include(s => s.SplitGroup).FirstOrDefaultAsync(s => s.Id == shareId);
                    }
                    share ??= await _context.SplitShares.Include(s => s.SplitGroup).FirstOrDefaultAsync(s => s.PaymentReference == reference);

                    if (share == null)
                    {
                        _logger.LogWarning("Split payment {Reference} does not match any share.", reference);
                    }
                    else if (share.Status != "Paid")
                    {
                        if (amountPaidKobo < ToKobo(share.Amount))
                        {
                            _logger.LogWarning("Split payment {Reference} underpaid: {Paid} kobo for {Expected}.", reference, amountPaidKobo, ToKobo(share.Amount));
                            return Ok();
                        }

                        // Lock the booking first so two friends paying at the same time can't both miss "fully funded".
                        await WalletLedger.LockBookingAsync(_context, share.SplitGroup.BookingId);
                        await _context.Entry(share.SplitGroup).ReloadAsync();

                        share.Status = "Paid";
                        share.PaymentReference = reference; // remember the reference that actually paid (for refunds)
                        share.SplitGroup.PaidShares += 1;
                        _logger.LogInformation("Split share paid ({Paid}/{Total}) for group {Group}.", share.SplitGroup.PaidShares, share.SplitGroup.TotalShares, share.SplitGroupId);

                        if (share.SplitGroup.PaidShares >= share.SplitGroup.TotalShares)
                        {
                            share.SplitGroup.Status = "Completed";
                            bookingToProcess = await _context.Bookings.Include(b => b.Property).Include(b => b.Guest)
                                .FirstOrDefaultAsync(b => b.Id == share.SplitGroup.BookingId);
                        }
                        await _context.SaveChangesAsync();
                    }
                }
                // ---------------- BRANCH 2: STANDARD SOLO BOOKING ----------------
                else if (Guid.TryParse(reference, out var bookingId))
                {
                    await WalletLedger.LockBookingAsync(_context, bookingId);
                    bookingToProcess = await _context.Bookings.Include(b => b.Property).Include(b => b.Guest)
                        .FirstOrDefaultAsync(b => b.Id == bookingId);

                    if (bookingToProcess != null && amountPaidKobo < ToKobo(bookingToProcess.TotalPrice))
                    {
                        _logger.LogWarning("Booking {BookingId} underpaid: {Paid} kobo for {Expected}.", bookingId, amountPaidKobo, ToKobo(bookingToProcess.TotalPrice));
                        return Ok();
                    }
                }

                // ---------------- ESCROW & PAYOUT ENGINE (runs once, when 100% funded) ----------------
                // "failed" is included: the guest may complete payment after our init call timed out.
                if (bookingToProcess != null && bookingToProcess.Status is "pending" or "split_pending" or "failed")
                {
                    bookingToProcess.Status = "paid";
                    if (bookingToProcess.CautionFeeAmount > 0) bookingToProcess.CautionFeeStatus = "Held";

                    decimal addOnsTotal = await _context.BookingAddOns
                        .Where(a => a.BookingId == bookingToProcess.Id)
                        .SumAsync(a => a.Price);

                    // Room + 5% fee = total − caution − add-ons. The host keeps the room rate and 100% of add-ons.
                    decimal roomWithFee = bookingToProcess.TotalPrice - bookingToProcess.CautionFeeAmount - addOnsTotal;
                    decimal roomRate = roomWithFee / (1 + BookingRules.PlatformFeeRate);
                    decimal hostEarnings = Math.Round(roomRate + addOnsTotal, 2);

                    var wallet = await WalletLedger.LockWalletAsync(_context, bookingToProcess.Property.HostId);
                    wallet.Balance += hostEarnings;
                    wallet.UpdatedAt = DateTime.UtcNow;

                    _context.Transactions.Add(new Transaction
                    {
                        WalletId = wallet.Id,
                        Amount = hostEarnings,
                        Type = "Credit",
                        Description = $"Room Earnings & Add-Ons (Escrow Held: ₦{bookingToProcess.CautionFeeAmount:N0})",
                        Reference = bookingToProcess.Id.ToString()
                    });

                    await _context.SaveChangesAsync();
                    await tx.CommitAsync();
                    _logger.LogInformation("Booking {BookingId} paid. Host credited ₦{Amount:N2}.", bookingToProcess.Id, hostEarnings);

                    await _emailQueue.QueueEmailAsync(new EmailMessagePayload
                    {
                        ToEmail = bookingToProcess.Guest.Email,
                        Subject = $"Payment received: {bookingToProcess.Property.Title}",
                        Body = $"<p>Hi {System.Net.WebUtility.HtmlEncode(bookingToProcess.Guest.Name)},</p>" +
                               $"<p>We've received your payment for <strong>{System.Net.WebUtility.HtmlEncode(bookingToProcess.Property.Title)}</strong> " +
                               $"({bookingToProcess.CheckIn:dd MMM yyyy} – {bookingToProcess.CheckOut:dd MMM yyyy}). " +
                               "Your host will confirm shortly and you'll receive your check-in code by email.</p>"
                    });
                }
                else
                {
                    await tx.CommitAsync();
                }

                return Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Paystack webhook processing failed");
                return StatusCode(500); // Paystack will retry
            }
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
