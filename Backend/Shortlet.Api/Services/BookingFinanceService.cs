using Microsoft.EntityFrameworkCore;
using Npgsql;
using Shortlet.Api.Helpers;
using Shortlet.Core.Entities;
using Shortlet.Core.Interfaces;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Services
{
    /// <summary>
    /// Every money movement that happens after a guest pays: refunds, cancellations, caution-fee
    /// release/claims and payout outcomes. Controllers, the Paystack webhook and the background
    /// maintenance worker all go through here so the rules live in one place.
    /// </summary>
    public class BookingFinanceService
    {
        public const string PurposeBooking = "booking";
        public const string PurposeCaution = "caution";
        public const int MaxRefundAttempts = 5;
        public static readonly TimeSpan RetryBackoff = TimeSpan.FromMinutes(15);

        private readonly AppDbContext _db;
        private readonly IPaystackService _paystack;
        private readonly IEmailQueue _email;
        private readonly IConfiguration _config;
        private readonly ILogger<BookingFinanceService> _logger;

        public BookingFinanceService(AppDbContext db, IPaystackService paystack, IEmailQueue email, IConfiguration config, ILogger<BookingFinanceService> logger)
        {
            _db = db;
            _paystack = paystack;
            _email = email;
            _config = config;
            _logger = logger;
        }

        /// <summary>How long after check-out a host has to claim from the caution fee before it auto-returns to the guest.</summary>
        public TimeSpan CautionClaimWindow =>
            TimeSpan.FromHours(int.TryParse(_config["Escrow:CautionClaimWindowHours"], out var h) && h > 0 ? h : 72);

        public DateTime CautionDeadline(Booking b) => b.CheckOut + CautionClaimWindow;

        // ------------------------------------------------------------------
        // Payments & refunds
        // ------------------------------------------------------------------

        /// <summary>The Paystack payments that funded a booking: one per paid split share, or the solo payment.</summary>
        public async Task<List<(string Reference, decimal Amount)>> PaymentsForAsync(Booking booking)
        {
            var shares = await _db.SplitShares
                .Where(s => s.SplitGroup.BookingId == booking.Id && s.Status == "Paid")
                .OrderBy(s => s.Id)
                .Select(s => new { s.PaymentReference, s.Amount })
                .ToListAsync();

            if (shares.Count > 0) return shares.Select(s => (s.PaymentReference, s.Amount)).ToList();

            var soloPaid = booking.Status is "paid" or "confirmed" or "completed" ||
                           await _db.Transactions.AnyAsync(t => t.Reference == booking.Id.ToString() && t.Type == "Credit");
            return soloPaid ? new() { (booking.PaymentReference, booking.TotalPrice) } : new();
        }

        /// <summary>
        /// Sends one refund to Paystack unless the same (reference, purpose) was already accepted.
        /// Failures are recorded and retried later by the maintenance worker. Returns true when Paystack
        /// has accepted (or previously accepted) the refund.
        /// </summary>
        public async Task<bool> RefundOnceAsync(Guid bookingId, string reference, decimal amount, bool partial, string purpose, string note)
        {
            var refund = await _db.Refunds.FirstOrDefaultAsync(r => r.TransactionReference == reference && r.Purpose == purpose);
            if (refund is { Status: "Processing" or "Processed" }) return true;
            if (refund is { Attempts: >= MaxRefundAttempts }) return false;
            // Back off between attempts so a refund Paystack keeps rejecting isn't retried every few minutes.
            if (refund is { Status: "Failed" } && refund.UpdatedAt > DateTime.UtcNow - RetryBackoff) return false;

            if (refund == null)
            {
                refund = new Refund { BookingId = bookingId, TransactionReference = reference, Amount = amount, Purpose = purpose, Status = "Requesting" };
                _db.Refunds.Add(refund);
                try
                {
                    await _db.SaveChangesAsync(); // unique index: a concurrent caller can't create a second one
                }
                catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
                {
                    _db.Entry(refund).State = EntityState.Detached;
                    return true; // someone else is already refunding this payment
                }
            }

            refund.Attempts += 1;
            refund.UpdatedAt = DateTime.UtcNow;
            PaystackResult result;
            try
            {
                result = await _paystack.RefundAsync(reference, partial ? amount : null, note);
            }
            catch (Exception ex)
            {
                result = new PaystackResult(false, ex.Message);
            }

            refund.Status = result.Ok ? "Processing" : "Failed";
            refund.FailureReason = result.Ok ? null : result.Message;
            await _db.SaveChangesAsync();

            if (result.Ok)
                _logger.LogInformation("Refund of ₦{Amount:N2} on {Reference} ({Purpose}) accepted by Paystack.", amount, reference, purpose);
            else
                _logger.LogError("Refund of ₦{Amount:N2} on {Reference} ({Purpose}) failed (attempt {Attempt}): {Message}", amount, reference, purpose, refund.Attempts, result.Message);
            return result.Ok;
        }

        /// <summary>Fully refunds every payment that funded the booking. Returns true if all were accepted.</summary>
        public async Task<bool> RefundAllPaymentsAsync(Booking booking, string note)
        {
            var allOk = true;
            foreach (var (reference, amount) in await PaymentsForAsync(booking))
                allOk &= await RefundOnceAsync(booking.Id, reference, amount, partial: false, PurposeBooking, note);
            return allOk;
        }

        /// <summary>
        /// Returns <paramref name="amountToGuest"/> of the caution fee. For split bookings it is spread over
        /// each friend's payment in proportion to what they paid.
        /// </summary>
        public async Task<bool> RefundCautionAsync(Booking booking, decimal amountToGuest)
        {
            if (amountToGuest <= 0) return true;
            var payments = await PaymentsForAsync(booking);
            if (payments.Count == 0) return false;

            var total = payments.Sum(p => p.Amount);
            var allOk = true;
            decimal allocated = 0;
            for (var i = 0; i < payments.Count; i++)
            {
                var portion = i == payments.Count - 1
                    ? amountToGuest - allocated
                    : Math.Round(amountToGuest * payments[i].Amount / total, 2);
                allocated += portion;
                if (portion <= 0) continue;
                allOk &= await RefundOnceAsync(booking.Id, payments[i].Reference, portion, partial: true, PurposeCaution, "Caution fee returned");
            }
            return allOk;
        }

        // ------------------------------------------------------------------
        // Cancellation (host declines, host never responds, dates conflict, split expires)
        // ------------------------------------------------------------------

        /// <summary>
        /// Cancels a booking, takes back whatever the host was credited for it, and refunds every payment.
        /// Refunds that fail are retried by the maintenance worker, so the booking is cancelled either way.
        /// Returns true when every refund was accepted immediately.
        /// </summary>
        /// <param name="payments">
        /// The payments to refund. Leave null to refund everything recorded against the booking; pass the
        /// just-received payment when cancelling inside the webhook (it isn't recorded as paid yet).
        /// </param>
        public async Task<bool> CancelAndRefundAsync(Guid bookingId, string newStatus, string reason, string guestMessage,
            List<(string Reference, decimal Amount)>? payments = null)
        {
            Booking? booking;
            await using (var tx = await _db.Database.BeginTransactionAsync())
            {
                await WalletLedger.LockBookingAsync(_db, bookingId);
                booking = await _db.Bookings.Include(b => b.Property).Include(b => b.Guest).FirstOrDefaultAsync(b => b.Id == bookingId);
                if (booking == null) return false;

                // Work out what was paid *before* the status changes (status is part of that check).
                payments ??= await PaymentsForAsync(booking);

                // Reverse exactly what the webhook credited the host (nothing if the host was never credited).
                var credited = await _db.Transactions.Where(t => t.Reference == booking.Id.ToString() && t.Type == "Credit").SumAsync(t => t.Amount);
                var alreadyReversed = await _db.Transactions.AnyAsync(t => t.Reference == booking.Id + "_refund");
                if (credited > 0 && !alreadyReversed)
                {
                    var wallet = await WalletLedger.LockWalletAsync(_db, booking.Property.HostId);
                    wallet.Balance -= credited;
                    wallet.UpdatedAt = DateTime.UtcNow;
                    _db.Transactions.Add(new Transaction
                    {
                        WalletId = wallet.Id,
                        Amount = credited,
                        Type = "Debit",
                        Description = $"Refund: {reason}",
                        Reference = booking.Id + "_refund"
                    });
                }

                var group = await _db.SplitGroups.FirstOrDefaultAsync(sg => sg.BookingId == booking.Id);
                if (group is { Status: "Pending" or "Completed" }) group.Status = newStatus == "expired" ? "Expired" : "Cancelled";

                if (booking.CautionFeeStatus is "Held" or "Pending") booking.CautionFeeStatus = "Refunded";
                booking.Status = newStatus;
                await _db.SaveChangesAsync();
                await tx.CommitAsync();
            }

            var refunded = true;
            foreach (var (reference, amount) in payments)
                refunded &= await RefundOnceAsync(booking.Id, reference, amount, partial: false, PurposeBooking, reason);
            _logger.LogInformation("Booking {BookingId} → {Status} ({Reason}); refunds accepted: {Ok}", booking.Id, newStatus, reason, refunded);

            await _email.QueueEmailAsync(new EmailMessagePayload
            {
                ToEmail = booking.Guest.Email,
                Subject = $"Your booking at {booking.Property.Title} was cancelled",
                Body = $"<p>Hi {System.Net.WebUtility.HtmlEncode(booking.Guest.Name)},</p><p>{System.Net.WebUtility.HtmlEncode(guestMessage)}</p>" +
                       "<p>Any payment for this booking is being refunded to the card or account it came from. Refunds usually arrive within 5–10 working days.</p>"
            });
            return refunded;
        }

        // ------------------------------------------------------------------
        // Caution fee: return to guest, or let the host keep some/all for damage
        // ------------------------------------------------------------------

        /// <summary>
        /// Resolves a held caution fee. <paramref name="claimAmount"/> goes to the host's wallet; the rest is
        /// refunded to the guest. Safe to call again: a half-finished release (status "Releasing") is resumed.
        /// </summary>
        public async Task<(bool Ok, string Message)> ResolveCautionAsync(Guid bookingId, decimal claimAmount, string? claimReason)
        {
            Booking? booking;
            await using (var tx = await _db.Database.BeginTransactionAsync())
            {
                await WalletLedger.LockBookingAsync(_db, bookingId);
                booking = await _db.Bookings.Include(b => b.Property).Include(b => b.Guest).FirstOrDefaultAsync(b => b.Id == bookingId);
                if (booking == null) return (false, "Booking not found.");

                if (booking.CautionFeeStatus == "Held")
                {
                    claimAmount = Math.Round(Math.Clamp(claimAmount, 0, booking.CautionFeeAmount), 2);
                    if (claimAmount > 0)
                    {
                        var wallet = await WalletLedger.LockWalletAsync(_db, booking.Property.HostId);
                        wallet.Balance += claimAmount;
                        wallet.UpdatedAt = DateTime.UtcNow;
                        _db.Transactions.Add(new Transaction
                        {
                            WalletId = wallet.Id,
                            Amount = claimAmount,
                            Type = "Credit",
                            Description = $"Caution fee claim: {claimReason}",
                            Reference = booking.Id + "_caution"
                        });
                    }
                    booking.CautionClaimAmount = claimAmount;
                    booking.CautionClaimReason = claimAmount > 0 ? claimReason : null;
                    booking.CautionFeeStatus = "Releasing";
                    await _db.SaveChangesAsync();
                }
                else if (booking.CautionFeeStatus != "Releasing")
                {
                    return (false, $"The caution fee is already {booking.CautionFeeStatus.ToLowerInvariant()}.");
                }
                await tx.CommitAsync();
            }

            var toGuest = booking.CautionFeeAmount - booking.CautionClaimAmount;
            var refunded = await RefundCautionAsync(booking, toGuest);
            if (!refunded)
                return (true, "Saved. The refund to the guest couldn’t be sent yet and will be retried automatically.");

            booking.CautionFeeStatus = booking.CautionClaimAmount <= 0 ? "Refunded"
                : booking.CautionClaimAmount >= booking.CautionFeeAmount ? "Claimed" : "PartlyClaimed";
            booking.CautionResolvedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            await _email.QueueEmailAsync(new EmailMessagePayload
            {
                ToEmail = booking.Guest.Email,
                Subject = $"Your caution fee for {booking.Property.Title}",
                Body = booking.CautionClaimAmount <= 0
                    ? $"<p>Good news: your caution fee of ₦{booking.CautionFeeAmount:N0} is being refunded in full.</p>"
                    : $"<p>Your host kept ₦{booking.CautionClaimAmount:N0} of your ₦{booking.CautionFeeAmount:N0} caution fee for: " +
                      $"{System.Net.WebUtility.HtmlEncode(booking.CautionClaimReason)}.</p>" +
                      (toGuest > 0 ? $"<p>The remaining ₦{toGuest:N0} is being refunded to you.</p>" : "")
            });
            return (true, booking.CautionFeeStatus switch
            {
                "Refunded" => "Caution fee returned to the guest.",
                "Claimed" => "Caution fee added to your wallet.",
                _ => $"₦{booking.CautionClaimAmount:N0} added to your wallet; ₦{toGuest:N0} returned to the guest."
            });
        }

        // ------------------------------------------------------------------
        // Payouts (bank withdrawals)
        // ------------------------------------------------------------------

        /// <summary>
        /// Records Paystack's final word on a withdrawal. Failed or reversed transfers put the money back in the
        /// host's wallet. Idempotent: only a "Pending" withdrawal changes.
        /// </summary>
        public async Task FinalizePayoutAsync(string reference, string paystackStatus)
        {
            var status = paystackStatus.ToLowerInvariant();
            var succeeded = status == "success";
            var failed = status is "failed" or "reversed" or "abandoned" or "rejected" or "blocked";
            if (!succeeded && !failed) return; // still pending / awaiting OTP

            await using var tx = await _db.Database.BeginTransactionAsync();
            var withdrawal = await _db.Transactions.FirstOrDefaultAsync(t => t.Reference == reference && t.Type == "Withdrawal");
            if (withdrawal == null) { _logger.LogWarning("Transfer update for unknown payout {Reference}", reference); return; }

            var wallet = await _db.Wallets.FirstAsync(w => w.Id == withdrawal.WalletId);
            wallet = await WalletLedger.LockWalletAsync(_db, wallet.HostId);
            await _db.Entry(withdrawal).ReloadAsync();
            if (withdrawal.Status != "Pending") return;

            if (succeeded)
            {
                withdrawal.Status = "Completed";
            }
            else
            {
                withdrawal.Status = "Failed";
                wallet.Balance += withdrawal.Amount;
                wallet.UpdatedAt = DateTime.UtcNow;
                _db.Transactions.Add(new Transaction
                {
                    WalletId = wallet.Id,
                    Amount = withdrawal.Amount,
                    Type = "Reversal",
                    Description = $"Withdrawal {status}: money returned to your wallet",
                    Reference = reference + "_reversal"
                });
                _logger.LogWarning("Payout {Reference} {Status}; ₦{Amount:N2} returned to wallet.", reference, status, withdrawal.Amount);
            }
            await _db.SaveChangesAsync();
            await tx.CommitAsync();
        }
    }
}
