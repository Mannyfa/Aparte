using System;

namespace Shortlet.Core.Entities
{
    public class PropertyCalendar
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        
        public Guid PropertyId { get; set; }
        public Property Property { get; set; }

        public Guid? BookingId { get; set; }
        public Booking Booking { get; set; }

        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
    }
}