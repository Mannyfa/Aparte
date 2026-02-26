// Backend/Shortlet.Core/DTOs/BookingDtos.cs
using System;

namespace Shortlet.Core.DTOs
{
    public class CreateBookingDto
    {
        public Guid PropertyId { get; set; }
        public DateTime CheckIn { get; set; }
        public DateTime CheckOut { get; set; }
    }

    public class BookingResultDto
    {
        public Guid BookingId { get; set; }
        public string PaymentUrl { get; set; } = string.Empty;
        public string Reference { get; set; } = string.Empty;
    }
}