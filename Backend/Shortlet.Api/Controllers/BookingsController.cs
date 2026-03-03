// Backend/Shortlet.Api/Controllers/BookingsController.cs
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Shortlet.Core.Entities;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Controllers
{
    // The DTO to receive the data from the React Checkout Modal
    public class CreateBookingRequest
    {
        public Guid PropertyId { get; set; }
        public DateTime CheckIn { get; set; }
        public DateTime CheckOut { get; set; }
        
        // Accepts the array of Add-On IDs the guest selected!
        public List<Guid>? AddOnIds { get; set; } 
    }

    [ApiController]
    [Route("api/[controller]")]
    [Authorize] // Only logged-in users can book
    public class BookingsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;

        public BookingsController(AppDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        [HttpPost]
        public async Task<IActionResult> CreateBooking([FromBody] CreateBookingRequest request)
        {
            try
            {
                // Get the currently logged-in guest's ID
                var guestIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(guestIdStr)) return Unauthorized(new { message = "User not logged in." });
                var guestId = Guid.Parse(guestIdStr);

                var guest = await _context.Users.FindAsync(guestId);
                
                var property = await _context.Properties.FindAsync(request.PropertyId);
                if (property == null) return NotFound(new { message = "Property not found" });

                // --- 1. CALCULATE NIGHTS ---
                var nights = (int)(request.CheckOut.Date - request.CheckIn.Date).TotalDays;
                if (nights <= 0) return BadRequest(new { message = "Invalid check-in/out dates." });

                // --- 2. CALCULATE BASE PRICE & PLATFORM FEE ---
                var totalRoomPrice = property.PricePerNight * nights;
                var platformFee = totalRoomPrice * 0.05m;

                // --- 3. CALCULATE LIFESTYLE ADD-ONS (SECURE BACKEND CALC) ---
                decimal addOnsTotal = 0;
                var verifiedAddOns = new List<PropertyAddOn>();

                // If the guest selected Add-Ons, fetch their REAL prices from the database
                if (request.AddOnIds != null && request.AddOnIds.Any())
                {
                    verifiedAddOns = await _context.PropertyAddOns
                        .Where(a => request.AddOnIds.Contains(a.Id) && a.PropertyId == property.Id)
                        .ToListAsync();

                    addOnsTotal = verifiedAddOns.Sum(a => a.Price);
                }

                // --- 4. CALCULATE GRAND TOTAL ---
                var finalPrice = totalRoomPrice + platformFee + addOnsTotal;

                // --- 5. CREATE THE BOOKING RECORD ---
                var bookingId = Guid.NewGuid(); // Generate ID first so we can use it for the reference
                
                var booking = new Booking
                {
                    Id = bookingId,
                    PropertyId = property.Id,
                    GuestId = guestId,
                    CheckIn = request.CheckIn,
                    CheckOut = request.CheckOut,
                    TotalPrice = finalPrice,
                    Status = "pending", // Will change to 'paid' via Paystack Webhook later
                    CheckInCode = new Random().Next(100000, 999999).ToString(),
                    
                    // FIX: Populate the old column to keep the strict Postgres Unique rule happy!
                    PaymentReference = bookingId.ToString() 
                };
                
                _context.Bookings.Add(booking);

                // --- 6. CREATE HISTORICAL RECEIPTS FOR ADD-ONS ---
                foreach (var addon in verifiedAddOns)
                {
                    _context.BookingAddOns.Add(new BookingAddOn
                    {
                        BookingId = booking.Id,
                        Name = addon.Name,
                        Price = addon.Price
                    });
                }

                await _context.SaveChangesAsync();

                // --- 7. INITIALIZE PAYSTACK ESCROW ---
                var paystackSecret = _config["PaystackSettings:SecretKey"] ?? _config["Paystack:SecretKey"]; 
                
                if (string.IsNullOrEmpty(paystackSecret)) {
                    return StatusCode(500, new { message = "Paystack Key missing from backend config." });
                }

                using var client = new HttpClient();
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", paystackSecret);

                // Paystack expects the amount in Kobo (multiply by 100)
                var amountInKobo = (long)(finalPrice * 100);

                var paystackPayload = new
                {
                    amount = amountInKobo,
                    email = guest?.Email ?? "guest@apartey.com",
                    reference = booking.Id.ToString(), 
                    callback_url = "https://aparteyng.vercel.app/my-trips" 
                };

                var content = new StringContent(JsonSerializer.Serialize(paystackPayload), Encoding.UTF8, "application/json");
                var response = await client.PostAsync("https://api.paystack.co/transaction/initialize", content);
                
                var responseString = await response.Content.ReadAsStringAsync();
                var paystackResult = JsonSerializer.Deserialize<JsonElement>(responseString);

                if (response.IsSuccessStatusCode)
                {
                    // Extract the secure checkout URL and send it to React
                    var authorizationUrl = paystackResult.GetProperty("data").GetProperty("authorization_url").GetString();
                    return Ok(new { paymentUrl = authorizationUrl });
                }
                else
                {
                    return BadRequest(new { message = "Failed to connect to Paystack Escrow." });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An internal error occurred: " + ex.Message });
            }
        }

       [HttpGet("guest")]
        public async Task<IActionResult> GetGuestBookings()
        {
            var guestIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(guestIdStr)) return Unauthorized();
            var guestId = Guid.Parse(guestIdStr);

            var bookings = await _context.Bookings
                .Include(b => b.Property)
                .Include(b => b.PurchasedAddOns) // <-- FIXED: Matches your entity property name!
                .Where(b => b.GuestId == guestId)
                .OrderByDescending(b => b.CreatedAt)
                .Select(b => new {
                    b.Id,
                    PropertyTitle = b.Property.Title,
                    City = b.Property.City,
                    ImageUrl = b.Property.ImageUrls.FirstOrDefault(),
                    b.CheckIn,
                    b.CheckOut,
                    b.TotalPrice,
                    b.Status,
                    b.CheckInCode,
                    AddOns = b.PurchasedAddOns // <-- FIXED
                })
                .ToListAsync();

            return Ok(bookings);
        }
    }
}