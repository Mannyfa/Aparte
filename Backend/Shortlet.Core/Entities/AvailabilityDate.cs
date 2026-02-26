using System;

namespace Shortlet.Core.Entities
{
    public class AvailabilityDate
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid PropertyId { get; set; }
        public DateTime Date { get; set; }
        public bool IsAvailable { get; set; } = true;
        public decimal? PriceOverride { get; set; }
        
        // Concurrency token to prevent race conditions during checkout
        public uint Version { get; set; } 
    }
}