// Backend/Shortlet.Api/Controllers/HostBookingsController.cs
using System;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR; // NEW
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Shortlet.Api.Hubs; // NEW
using Shortlet.Core.Entities;
using Shortlet.Core.Interfaces; // NEW
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class HostBookingsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly string _paystackSecret;
        private readonly IEmailQueue _emailQueue; // NEW
        private readonly IHubContext<ChatHub> _hubContext; // NEW

        public HostBookingsController(
            AppDbContext context, 
            IConfiguration config, 
            IEmailQueue emailQueue, 
            IHubContext<ChatHub> hubContext)
        {
            _context = context;
            _paystackSecret = config["Paystack:SecretKey"] ?? throw new Exception("Paystack key missing");
            _emailQueue = emailQueue;
            _hubContext = hubContext;
        }

        [HttpGet]
        public async Task<IActionResult> GetHostBookings()
        {
            var hostId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier).Value);
            var bookings = await _context.Bookings
                .Include(b => b.Property)
                .Where(b => b.Property.HostId == hostId)
                .OrderByDescending(b => b.CheckIn)
                .Select(b => new {
                    b.Id, PropertyTitle = b.Property.Title, b.CheckIn, b.CheckOut, b.TotalPrice, b.Status, b.CheckInCode
                }).ToListAsync();
            return Ok(bookings);
        }

        [HttpPost("{id}/accept")]
        public async Task<IActionResult> AcceptBooking(Guid id)
        {
            var booking = await _context.Bookings
                .Include(b => b.Property)
                .Include(b => b.Guest) // Need the guest data to email them!
                .FirstOrDefaultAsync(b => b.Id == id);
                
            if (booking == null) return NotFound();

            booking.Status = "confirmed";
            booking.CheckInCode = new Random().Next(1000, 9999).ToString();

            _context.PropertyCalendars.Add(new PropertyCalendar {
                PropertyId = booking.PropertyId, BookingId = booking.Id, StartDate = booking.CheckIn, EndDate = booking.CheckOut
            });

            await _context.SaveChangesAsync();

            // --- 1. FIRE TO BACKGROUND EMAIL QUEUE (Takes 0.001 seconds!) ---
            await _emailQueue.QueueEmailAsync(new EmailMessagePayload
            {
                ToEmail = booking.Guest.Email,
                Subject = $"Booking Confirmed: {booking.Property.Title}",
                Body = $"Hello {booking.Guest.Name}, your booking is confirmed! Your Gate Code is: {booking.CheckInCode}"
            });

            // --- 2. FIRE SIGNALR REAL-TIME NOTIFICATION ---
            await _hubContext.Clients.Group(booking.GuestId.ToString())
                .SendAsync("ReceiveNotification", new {
                    title = "Booking Accepted! 🎉",
                    message = $"Your stay at {booking.Property.Title} was just approved. Check your trips for the gate code!"
                });

            return Ok(new { message = "Booking Confirmed!", code = booking.CheckInCode });
        }

        [HttpPost("{id}/reject")]
        public async Task<IActionResult> RejectBooking(Guid id)
        {
            var booking = await _context.Bookings.Include(b => b.Property).Include(b => b.Guest).FirstOrDefaultAsync(b => b.Id == id);
            if (booking == null) return NotFound();

            if (booking.Status == "paid")
            {
                var wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.HostId == booking.Property.HostId);
                decimal hostEarnings = booking.TotalPrice * 0.95m; 
                wallet.Balance -= hostEarnings;

                _context.Transactions.Add(new Transaction {
                    WalletId = wallet.Id, Amount = hostEarnings, Type = "Debit", Description = "Refund for rejected booking", Reference = booking.PaymentReference + "_refund"
                });

                using var client = new HttpClient();
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _paystackSecret);
                var content = new StringContent(JsonSerializer.Serialize(new { transaction = booking.PaymentReference }), Encoding.UTF8, "application/json");
                await client.PostAsync("https://api.paystack.co/refund", content);
            }

            booking.Status = "rejected";
            await _context.SaveChangesAsync();

            // --- FIRE REAL-TIME NOTIFICATION TO GUEST ---
            await _hubContext.Clients.Group(booking.GuestId.ToString())
                .SendAsync("ReceiveNotification", new {
                    title = "Booking Declined",
                    message = $"The host couldn't accept your dates for {booking.Property.Title}. A full refund has been issued."
                });

            return Ok(new { message = "Booking rejected. Guest has been refunded." });
        }
    }
}