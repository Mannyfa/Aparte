using System;

namespace Shortlet.Core.Entities
{
    /// <summary>Seasonal nightly price for a date range (both dates inclusive, UTC midnight).</summary>
    public class PriceRule
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid PropertyId { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public decimal NightlyPrice { get; set; }
        public string? Label { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
