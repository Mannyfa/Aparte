using System;
using System.Text.Json.Serialization;

namespace Shortlet.Core.Entities
{
    public class BookingAddOn
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid BookingId { get; set; }
        public string Name { get; set; } = string.Empty; // Snapshot of the name at checkout
        public decimal Price { get; set; } // Snapshot of the price at checkout
        
        [JsonIgnore]
        public Booking? Booking { get; set; }
    }
}