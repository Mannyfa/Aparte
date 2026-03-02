using System;
using System.Text.Json.Serialization;

namespace Shortlet.Core.Entities
{
    public class PropertyAddOn
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid PropertyId { get; set; }
        public string Name { get; set; } = string.Empty; // e.g., "Airport Pickup"
        public string Description { get; set; } = string.Empty; // e.g., "Murtala Muhammed Airport to Lekki"
        public decimal Price { get; set; }
        
        [JsonIgnore]
        public Property? Property { get; set; }
    }
}