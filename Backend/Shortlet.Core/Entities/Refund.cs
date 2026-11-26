using System;

namespace Shortlet.Core.Entities
{
    /// <summary>
    /// One refund request sent to Paystack. Kept as an audit trail and to make refunds idempotent:
    /// the same (TransactionReference, Purpose) is never refunded twice.
    /// </summary>
    public class Refund
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid BookingId { get; set; }

        /// <summary>The Paystack transaction being refunded (booking id or split share reference).</summary>
        public string TransactionReference { get; set; } = string.Empty;

        public decimal Amount { get; set; }

        /// <summary>"booking" (full refund of a payment) or "caution" (return of the escrowed deposit).</summary>
        public string Purpose { get; set; } = string.Empty;

        /// <summary>Processing (accepted by Paystack) → Processed, or Failed (needs a retry / manual action).</summary>
        public string Status { get; set; } = "Processing";
        public string? FailureReason { get; set; }

        /// <summary>How many times the refund was sent to Paystack; failed refunds are retried a few times.</summary>
        public int Attempts { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
