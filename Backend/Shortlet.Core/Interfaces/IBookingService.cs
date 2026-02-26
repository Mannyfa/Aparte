// Backend/Shortlet.Core/Interfaces/IBookingService.cs
using System;
using System.Threading.Tasks;
using Shortlet.Core.DTOs;

namespace Shortlet.Core.Interfaces
{
    public interface IBookingService
    {
        Task<BookingResultDto> CreatePendingBookingAsync(Guid guestId, string guestEmail, CreateBookingDto request);
    }
}