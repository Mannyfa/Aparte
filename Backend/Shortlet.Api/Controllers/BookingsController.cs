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
    public class CreateBookingRequest
    {
        public Guid PropertyId { get; set; }
        public DateTime CheckIn { get; set; }
        public DateTime CheckOut { get; set; }
        public List<Guid>? AddOnIds { get; set; } 
        
        // --- APARTEY SPLIT PAYMENTS ---
        public bool IsSplit { get; set; } = false;
        public int SplitWays { get; set; } = 1;
    }

    // DTO for friends paying their share via WhatsApp link
    public class PayShareRequest 
    { 
        public string Email { get; set; } 
    }

    [ApiController]
    [Route("api/[controller]")]
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
        [Authorize] 
        public async Task<IActionResult> CreateBooking([FromBody] CreateBookingRequest request)
        {
            try
            {
                var guestIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(guestIdStr)) return Unauthorized(new { message = "User not logged in." });
                var guestId = Guid.Parse(guestIdStr);

                var guest = await _context.Users.FindAsync(guestId);
                var property = await _context.Properties.FindAsync(request.PropertyId);
                if (property == null) return NotFound(new { message = "Property not found" });

                var nights = (int)(request.CheckOut.Date - request.CheckIn.Date).TotalDays;
                if (nights <= 0) return BadRequest(new { message = "Invalid check-in/out dates." });

                // --- DOUBLE-BOOKING GUARDRAIL ---
                var isOverlapping = await _context.Bookings.AnyAsync(b =>
                    b.PropertyId == request.PropertyId &&
                    (b.Status == "paid" || b.Status == "confirmed" || b.Status == "pending" || b.Status == "split_pending") &&
                    request.CheckIn < b.CheckOut && request.CheckOut > b.CheckIn
                );

                if (isOverlapping) return BadRequest(new { message = "Oops! Some of these dates were just booked by someone else." });

                // --- FINANCIAL MATH ---
                var totalRoomPrice = property.PricePerNight * nights;
                var platformFee = totalRoomPrice * 0.05m; 

                decimal addOnsTotal = 0;
                var verifiedAddOns = new List<PropertyAddOn>();

                if (request.AddOnIds != null && request.AddOnIds.Any())
                {
                    verifiedAddOns = await _context.PropertyAddOns
                        .Where(a => request.AddOnIds.Contains(a.Id) && a.PropertyId == property.Id)
                        .ToListAsync();
                    addOnsTotal = verifiedAddOns.Sum(a => a.Price);
                }

                var cautionFee = property.CautionFee; 
                var finalPrice = totalRoomPrice + platformFee + addOnsTotal + cautionFee;

                var bookingId = Guid.NewGuid(); 
                
                var booking = new Booking
                {
                    Id = bookingId,
                    PropertyId = property.Id,
                    GuestId = guestId,
                    CheckIn = request.CheckIn,
                    CheckOut = request.CheckOut,
                    TotalPrice = finalPrice,
                    CautionFeeAmount = cautionFee, 
                    CautionFeeStatus = cautionFee > 0 ? "Pending" : "None", 
                    
                    // If splitting, hold the booking status until all friends pay!
                    Status = request.IsSplit && request.SplitWays > 1 ? "split_pending" : "pending", 
                    CheckInCode = new Random().Next(100000, 999999).ToString(),
                    PaymentReference = bookingId.ToString() 
                };
                
                _context.Bookings.Add(booking);

                foreach (var addon in verifiedAddOns)
                {
                    _context.BookingAddOns.Add(new BookingAddOn { BookingId = booking.Id, Name = addon.Name, Price = addon.Price });
                }

                await _context.SaveChangesAsync(); // Save the booking first to generate its ID

                // =================================================================
                // 🚀 NEW: THE APARTEY SPLIT ENGINE 
                // =================================================================
                if (request.IsSplit && request.SplitWays > 1)
                {
                    var splitGroup = new SplitGroup
                    {
                        BookingId = booking.Id,
                        TotalAmount = finalPrice,
                        TotalShares = request.SplitWays,
                        PaidShares = 0
                    };
                    _context.SplitGroups.Add(splitGroup);
                    await _context.SaveChangesAsync(); 

                    // Calculate slices. We give the last person any remaining Kobo to make the math flawless.
                    decimal splitAmount = Math.Round(finalPrice / request.SplitWays, 2);
                    decimal totalAllocated = 0;

                    for (int i = 0; i < request.SplitWays; i++)
                    {
                        decimal shareAmount = (i == request.SplitWays - 1) ? (finalPrice - totalAllocated) : splitAmount;
                        totalAllocated += shareAmount;

                        _context.SplitShares.Add(new SplitShare
                        {
                            SplitGroupId = splitGroup.Id,
                            Amount = shareAmount,
                            // Webhook will use this 'SPLIT_' prefix to know it's a fractional payment!
                            PaymentReference = $"SPLIT_{Guid.NewGuid()}" 
                        });
                    }
                    await _context.SaveChangesAsync();

                    // Tell the frontend to redirect the lead guest to their new Split Management Dashboard
                    return Ok(new { isSplit = true, splitGroupId = splitGroup.Id });
                }

                // =================================================================
                // 💳 STANDARD PAYSTACK INITIALIZATION (For Solo Payers)
                // =================================================================
                var paystackSecret = _config["PaystackSettings:SecretKey"] ?? _config["Paystack:SecretKey"]; 
                if (string.IsNullOrEmpty(paystackSecret)) return StatusCode(500, new { message = "Paystack Key missing from backend config." });

                using var client = new HttpClient();
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", paystackSecret);

                var amountInKobo = (long)(finalPrice * 100);
                var paystackPayload = new
                {
                    amount = amountInKobo,
                    email = guest?.Email ?? "guest@apartey.com",
                    reference = booking.Id.ToString(), 
                    callback_url = "https://aparteyng.vercel.app/my-trips" 
                };

                var content = new StringContent(JsonSerializer.Serialize(paystackPayload), Encoding.UTF8, "application/json");
                var response = await client.PostAsync("https://api.api.paystack.co/transaction/initialize", content);
                var responseString = await response.Content.ReadAsStringAsync();
                var paystackResult = JsonSerializer.Deserialize<JsonElement>(responseString);

                if (response.IsSuccessStatusCode)
                {
                    var authorizationUrl = paystackResult.GetProperty("data").GetProperty("authorization_url").GetString();
                    return Ok(new { isSplit = false, paymentUrl = authorizationUrl });
                }
                else return BadRequest(new { message = "Failed to connect to Paystack Escrow." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An internal error occurred: " + ex.Message });
            }
        }

        // =================================================================
        // 📊 NEW: FETCH SPLIT GROUP DATA FOR LEAD GUEST DASHBOARD
        // =================================================================
        [HttpGet("split/{id}")]
        [Authorize]
        public async Task<IActionResult> GetSplitDetails(Guid id)
        {
            var splitGroup = await _context.SplitGroups
                .Include(sg => sg.Booking)
                .ThenInclude(b => b.Property)
                .Include(sg => sg.Shares)
                .FirstOrDefaultAsync(sg => sg.Id == id);

            if (splitGroup == null) return NotFound("Split group not found.");

            return Ok(new {
                splitGroup.Id,
                PropertyTitle = splitGroup.Booking.Property.Title,
                splitGroup.TotalAmount,
                splitGroup.TotalShares,
                splitGroup.PaidShares,
                splitGroup.Status,
                splitGroup.ExpiresAt,
                Shares = splitGroup.Shares.Select(s => new {
                    s.Id,
                    s.Amount,
                    s.Status
                })
            });
        }

        // =================================================================
        // 💸 NEW: PAY A SPECIFIC FRACTION VIA WHATSAPP LINK (No Login Required!)
        // =================================================================
        [HttpPost("split/{shareId}/pay")]
        [AllowAnonymous] 
        public async Task<IActionResult> PaySplitShare(Guid shareId, [FromBody] PayShareRequest request)
        {
            var share = await _context.SplitShares
                .Include(s => s.SplitGroup)
                .ThenInclude(sg => sg.Booking)
                .FirstOrDefaultAsync(s => s.Id == shareId);

            if (share == null) return NotFound("Split share not found.");
            if (share.Status == "Paid") return BadRequest("This share has already been paid!");
            if (share.SplitGroup.ExpiresAt < DateTime.UtcNow) return BadRequest("This group payment window has expired.");

            var paystackSecret = _config["PaystackSettings:SecretKey"] ?? _config["Paystack:SecretKey"]; 
            using var client = new HttpClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", paystackSecret);

            var paystackPayload = new
            {
                amount = (long)(share.Amount * 100), // Convert to Kobo
                email = string.IsNullOrEmpty(request.Email) ? "friend@apartey.com" : request.Email,
                reference = share.PaymentReference, // Uses the SPLIT_ Guid!
                callback_url = $"https://aparteyng.vercel.app/split-success/{share.SplitGroupId}" 
            };

            var content = new StringContent(JsonSerializer.Serialize(paystackPayload), Encoding.UTF8, "application/json");
            var response = await client.PostAsync("https://api.paystack.co/transaction/initialize", content);
            
            if (response.IsSuccessStatusCode)
            {
                var responseString = await response.Content.ReadAsStringAsync();
                var paystackResult = JsonSerializer.Deserialize<JsonElement>(responseString);
                var authorizationUrl = paystackResult.GetProperty("data").GetProperty("authorization_url").GetString();
                
                return Ok(new { paymentUrl = authorizationUrl });
            }

            return BadRequest("Failed to connect to Paystack for split payment.");
        }

       [HttpGet("guest")]
       [Authorize]
        public async Task<IActionResult> GetGuestBookings()
        {
            var guestIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(guestIdStr)) return Unauthorized();
            var guestId = Guid.Parse(guestIdStr);

            var bookings = await _context.Bookings
                .Include(b => b.Property)
                .Include(b => b.PurchasedAddOns) 
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
                    AddOns = b.PurchasedAddOns 
                })
                .ToListAsync();

            return Ok(bookings);
        }
    }
}