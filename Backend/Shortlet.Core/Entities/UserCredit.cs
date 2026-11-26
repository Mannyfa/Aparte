using System;

namespace Shortlet.Core.Entities
{
    /// <summary>A credit grant for a user (e.g. a referral reward). Spending is tracked on Booking.CreditApplied.</summary>
    public class UserCredit
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid UserId { get; set; }
        public decimal Amount { get; set; }
        /// <summary>e.g. "referral_reward".</summary>
        public string Reason { get; set; } = string.Empty;
        public Guid? SourceUserId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
