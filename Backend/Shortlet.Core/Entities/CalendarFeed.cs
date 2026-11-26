using System;

namespace Shortlet.Core.Entities
{
    /// <summary>An external iCal calendar (e.g. the property's Airbnb listing) imported into Apartey.</summary>
    public class CalendarFeed
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid PropertyId { get; set; }
        public string Name { get; set; } = string.Empty;   // "Airbnb", "Booking.com"…
        public string Url { get; set; } = string.Empty;
        public DateTime? LastSyncedAt { get; set; }
        public string? LastError { get; set; }
        public int EventCount { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
