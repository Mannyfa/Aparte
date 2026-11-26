using System;

namespace Shortlet.Core.Entities
{
    public class PromoCode
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        /// <summary>Stored uppercase, unique.</summary>
        public string Code { get; set; } = string.Empty;
        /// <summary>"percent" or "fixed".</summary>
        public string DiscountType { get; set; } = "percent";
        public decimal DiscountValue { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public int? UsageLimit { get; set; }
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
