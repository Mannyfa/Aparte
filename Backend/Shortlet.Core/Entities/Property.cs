// Backend/Shortlet.Core/Entities/Property.cs
using System;
using System.Collections.Generic;

namespace Shortlet.Core.Entities
{
    public class Property
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid HostId { get; set; }
        public User Host { get; set; } = null!; // Navigation property
        
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public decimal PricePerNight { get; set; }
        
        // Location data
        public string State { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string Area { get; set; } = string.Empty;
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        
        public string AmenitiesJson { get; set; } = "[]";
        public string Status { get; set; } = "pending_approval"; // pending_approval, active, suspended
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

       
        public List<string> ImageUrls { get; set; } = new List<string>();
        public List<string> Amenities { get; set; } = new List<string>();
        public List<string> HouseRules { get; set; } = new List<string>();

        public ICollection<PropertyAddOn> AddOns { get; set; } = new List<PropertyAddOn>();

        public ICollection<PropertyImage> Images { get; set; } = new List<PropertyImage>();
    }
}

