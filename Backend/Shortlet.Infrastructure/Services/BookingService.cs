// Backend/Shortlet.Infrastructure/Services/BookingService.cs
using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Shortlet.Core.DTOs;
using Shortlet.Core.Entities;
using Shortlet.Core.Interfaces;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Infrastructure.Services
{
    public class BookingService : IBookingService
    {
        private readonly AppDbContext _context;
        private readonly IPaystackService _paystack;

        public BookingService(AppDbContext context, IPaystackService paystack)
        {
            _context = context;
            _paystack = paystack;
        }

        public async Task<BookingResultDto> CreatePendingBookingAsync(Guid guestId, string guestEmail, CreateBookingDto request)
        {
            // 1. Fetch Property to calculate price SERVER-SIDE
            var property = await _context.Properties.FindAsync(request.PropertyId) 
                ?? throw new Exception("Property not found.");

            int totalDays = (request.CheckOut - request.CheckIn).Days;
            if (totalDays <= 0) throw new Exception("Invalid dates.");

            // 2. Generate exact price & Ref
            decimal totalAmount = property.PricePerNight * totalDays;
            decimal serviceFee = totalAmount * 0.05m;
            string paymentRef = $"BK-{Guid.NewGuid().ToString("N")[..10].ToUpper()}";

            // 3. Save pending booking safely (EF Core handles the transaction automatically here)
            var booking = new Booking
            {
                PropertyId = request.PropertyId,
                GuestId = guestId,
                CheckIn = request.CheckIn,
                CheckOut = request.CheckOut,
                TotalPrice = totalAmount + serviceFee,
                ServiceFee = serviceFee,
                Status = "pending", 
                PaymentReference = paymentRef
            };

            _context.Bookings.Add(booking);
            await _context.SaveChangesAsync(); // Database lock is released immediately after this!

            // 4. Call Paystack securely OUTSIDE the database lock
            try
            {
                var paymentUrl = await _paystack.InitializePaymentAsync(booking.TotalPrice, paymentRef, guestEmail);

                return new BookingResultDto 
                { 
                    BookingId = booking.Id, 
                    PaymentUrl = paymentUrl,
                    Reference = paymentRef 
                };
            }
            catch (Exception ex)
            {
                // 5. If Paystack fails (e.g. bad API key or no internet), we gracefully mark the booking as failed
                booking.Status = "failed";
                await _context.SaveChangesAsync();
                
                throw new Exception($"Payment gateway failed to initialize: {ex.Message}");
            }
        }
    }
}