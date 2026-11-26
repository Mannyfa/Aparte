using System;

namespace Shortlet.Core.Entities
{
    /// <summary>
    /// A date range on a property's calendar (check-out day exclusive). Three kinds, by <see cref="Source"/>:
    ///  - "booking": mirror of an accepted booking (BookingId set);
    ///  - "host":    dates the host blocked by hand;
    ///  - "feed":    dates imported from an external calendar (Airbnb, Booking.com…) via <see cref="FeedId"/>.
    /// Rows without a BookingId make the dates unavailable to guests.
    /// </summary>
    public class PropertyCalendar
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid PropertyId { get; set; }
        public Property Property { get; set; } = null!;

        public Guid? BookingId { get; set; }
        public Booking? Booking { get; set; }

        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }

        public string Source { get; set; } = "booking";
        public string? Note { get; set; }

        /// <summary>The external calendar this block was imported from (Source = "feed").</summary>
        public Guid? FeedId { get; set; }
        public string? ExternalUid { get; set; }
    }
}
