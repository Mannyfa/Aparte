using System.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Shortlet.Api.Helpers;
using Shortlet.Core.Entities;
using Shortlet.Core.Interfaces;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Controllers
{
    public class CreateBookingRequest
    {
        public Guid PropertyId { get; set; }
        /// <summary>Calendar date ("yyyy-MM-dd"). Any time part is ignored.</summary>
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
        public string? Email { get; set; }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class BookingsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly IPaystackService _paystack;
        private readonly ILogger<BookingsController> _logger;

        public BookingsController(AppDbContext context, IConfiguration config, IPaystackService paystack, ILogger<BookingsController> logger)
        {
            _context = context;
            _config = config;
            _paystack = paystack;
            _logger = logger;
        }

        private string FrontendUrl(string path) =>
            (_config["Frontend:BaseUrl"] ?? "https://aparteyng.vercel.app").TrimEnd('/') + path;

        [HttpPost]
        [Authorize]
        public async Task<IActionResult> CreateBooking([FromBody] CreateBookingRequest request)
        {
            var guestId = User.GetUserId();
            if (guestId == null) return Unauthorized(new { message = "User not logged in." });

            var checkIn = BookingRules.ToUtcDate(request.CheckIn);
            var checkOut = BookingRules.ToUtcDate(request.CheckOut);
            var now = DateTime.UtcNow;
            var nights = (int)(checkOut - checkIn).TotalDays;

            if (nights <= 0) return BadRequest(new { message = "Check-out must be after check-in." });
            if (checkIn < now.Date) return BadRequest(new { message = "Check-in date is in the past." });
            if (nights > BookingRules.MaxNights) return BadRequest(new { message = $"Bookings are limited to {BookingRules.MaxNights} nights." });

            var isSplit = request.IsSplit && request.SplitWays > 1;
            if (isSplit && request.SplitWays > BookingRules.MaxSplitWays)
                return BadRequest(new { message = $"A booking can be split at most {BookingRules.MaxSplitWays} ways." });

            var guest = await _context.Users.FindAsync(guestId.Value);
            if (guest == null) return Unauthorized(new { message = "User not found." });

            var property = await _context.Properties.FindAsync(request.PropertyId);
            if (property == null || property.Status == "suspended") return NotFound(new { message = "Property not found" });
            if (property.HostId == guestId) return BadRequest(new { message = "You cannot book your own property." });

            Booking booking;
            SplitGroup? splitGroup = null;

            // Serializable isolation: two guests racing for the same dates can't both pass the overlap check.
            await using (var tx = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable))
            {
                try
                {
                    var isOverlapping = await _context.Bookings
                        .Where(b => b.PropertyId == property.Id && checkIn < b.CheckOut && checkOut > b.CheckIn)
                        .BlockingDates(_context, now)
                        .AnyAsync();

                    if (isOverlapping)
                        return Conflict(new { message = "Oops! Some of these dates were just booked by someone else." });

                    // --- FINANCIAL MATH ---
                    var totalRoomPrice = property.PricePerNight * nights;
                    var platformFee = Math.Round(totalRoomPrice * BookingRules.PlatformFeeRate, 2);

                    var verifiedAddOns = new List<PropertyAddOn>();
                    if (request.AddOnIds is { Count: > 0 })
                    {
                        verifiedAddOns = await _context.PropertyAddOns
                            .Where(a => request.AddOnIds.Contains(a.Id) && a.PropertyId == property.Id)
                            .ToListAsync();
                    }
                    var addOnsTotal = verifiedAddOns.Sum(a => a.Price);
                    var cautionFee = property.CautionFee;
                    var finalPrice = totalRoomPrice + platformFee + addOnsTotal + cautionFee;

                    var bookingId = Guid.NewGuid();
                    booking = new Booking
                    {
                        Id = bookingId,
                        PropertyId = property.Id,
                        GuestId = guestId.Value,
                        CheckIn = checkIn,
                        CheckOut = checkOut,
                        TotalPrice = finalPrice,
                        ServiceFee = platformFee,
                        CautionFeeAmount = cautionFee,
                        CautionFeeStatus = cautionFee > 0 ? "Pending" : "None",
                        Status = isSplit ? "split_pending" : "pending",
                        CheckInCode = BookingRules.NewCheckInCode(),
                        PaymentReference = bookingId.ToString()
                    };
                    _context.Bookings.Add(booking);

                    foreach (var addon in verifiedAddOns)
                        _context.BookingAddOns.Add(new BookingAddOn { BookingId = booking.Id, Name = addon.Name, Price = addon.Price });

                    // =================================================================
                    // THE APARTEY SPLIT ENGINE
                    // =================================================================
                    if (isSplit)
                    {
                        splitGroup = new SplitGroup
                        {
                            BookingId = booking.Id,
                            TotalAmount = finalPrice,
                            TotalShares = request.SplitWays,
                            PaidShares = 0,
                            ExpiresAt = now.AddHours(24)
                        };
                        _context.SplitGroups.Add(splitGroup);

                        // The last person absorbs rounding so the shares add up exactly.
                        var splitAmount = Math.Round(finalPrice / request.SplitWays, 2);
                        decimal allocated = 0;
                        for (int i = 0; i < request.SplitWays; i++)
                        {
                            var shareAmount = i == request.SplitWays - 1 ? finalPrice - allocated : splitAmount;
                            allocated += shareAmount;
                            var share = new SplitShare { SplitGroupId = splitGroup.Id, Amount = shareAmount };
                            share.PaymentReference = BookingRules.NewSplitReference(share.Id);
                            _context.SplitShares.Add(share);
                        }
                    }

                    await _context.SaveChangesAsync();
                    await tx.CommitAsync();
                }
                catch (Exception ex) when (IsSerializationFailure(ex))
                {
                    return Conflict(new { message = "Oops! Some of these dates were just booked by someone else." });
                }
            }

            if (splitGroup != null)
                return Ok(new { isSplit = true, splitGroupId = splitGroup.Id });

            // =================================================================
            // STANDARD PAYSTACK INITIALIZATION (solo payers)
            // =================================================================
            try
            {
                var paymentUrl = await _paystack.InitializePaymentAsync(
                    booking.TotalPrice, booking.PaymentReference, guest.Email, FrontendUrl("/my-trips"));
                return Ok(new { isSplit = false, paymentUrl });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Paystack initialization failed for booking {BookingId}", booking.Id);
                booking.Status = "failed"; // release the dates immediately
                await _context.SaveChangesAsync();
                return StatusCode(502, new { message = "Could not start the payment. Please try again." });
            }
        }

        private static bool IsSerializationFailure(Exception ex)
        {
            for (var e = ex; e != null; e = e.InnerException)
                if (e is PostgresException pg && pg.SqlState == PostgresErrorCodes.SerializationFailure) return true;
            return false;
        }

        // =================================================================
        // SPLIT GROUP DETAILS
        // Anonymous on purpose: friends open this from a WhatsApp link without an account.
        // The group id is an unguessable GUID and only non-personal data is returned.
        // =================================================================
        [HttpGet("split/{id}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetSplitDetails(Guid id)
        {
            var splitGroup = await _context.SplitGroups
                .Include(sg => sg.Booking).ThenInclude(b => b.Property)
                .Include(sg => sg.Shares)
                .FirstOrDefaultAsync(sg => sg.Id == id);

            if (splitGroup == null) return NotFound(new { message = "Split group not found." });

            var expired = splitGroup.Status != "Completed" && splitGroup.ExpiresAt < DateTime.UtcNow;

            return Ok(new
            {
                splitGroup.Id,
                PropertyTitle = splitGroup.Booking.Property.Title,
                splitGroup.Booking.CheckIn,
                splitGroup.Booking.CheckOut,
                splitGroup.TotalAmount,
                splitGroup.TotalShares,
                splitGroup.PaidShares,
                Status = expired ? "Expired" : splitGroup.Status,
                splitGroup.ExpiresAt,
                Shares = splitGroup.Shares.OrderBy(s => s.Amount).Select(s => new { s.Id, s.Amount, s.Status })
            });
        }

        // =================================================================
        // PAY A SPECIFIC SHARE VIA WHATSAPP LINK (no login required)
        // =================================================================
        [HttpPost("split/{shareId}/pay")]
        [AllowAnonymous]
        public async Task<IActionResult> PaySplitShare(Guid shareId, [FromBody] PayShareRequest request)
        {
            var share = await _context.SplitShares
                .Include(s => s.SplitGroup)
                .FirstOrDefaultAsync(s => s.Id == shareId);

            if (share == null) return NotFound(new { message = "Split share not found." });
            if (share.Status == "Paid") return BadRequest(new { message = "This share has already been paid!" });
            if (share.SplitGroup.Status != "Pending") return BadRequest(new { message = "This group booking is no longer collecting payments." });
            if (share.SplitGroup.ExpiresAt < DateTime.UtcNow) return BadRequest(new { message = "This group payment window has expired." });

            var email = request.Email?.Trim();
            if (string.IsNullOrEmpty(email) || !email.Contains('@'))
                return BadRequest(new { message = "Please enter a valid email address for the receipt." });

            // Paystack refuses to re-use a reference, so every attempt gets a fresh one.
            share.PaymentReference = BookingRules.NewSplitReference(share.Id);
            await _context.SaveChangesAsync();

            try
            {
                var paymentUrl = await _paystack.InitializePaymentAsync(
                    share.Amount, share.PaymentReference, email, FrontendUrl($"/split-success/{share.SplitGroupId}"));
                return Ok(new { paymentUrl });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Paystack initialization failed for split share {ShareId}", share.Id);
                return StatusCode(502, new { message = "Failed to connect to Paystack for split payment." });
            }
        }

        [HttpGet("guest")]
        [Authorize]
        public async Task<IActionResult> GetGuestBookings()
        {
            var guestId = User.GetUserId();
            if (guestId == null) return Unauthorized();

            var bookings = await _context.Bookings
                .Where(b => b.GuestId == guestId.Value && b.Status != "failed")
                .OrderByDescending(b => b.CreatedAt)
                .Select(b => new
                {
                    b.Id,
                    b.PropertyId,
                    PropertyTitle = b.Property.Title,
                    City = b.Property.City,
                    ImageUrl = b.Property.ImageUrls.FirstOrDefault(),
                    b.CheckIn,
                    b.CheckOut,
                    b.TotalPrice,
                    b.Status,
                    // Only reveal the gate code once the host has confirmed the stay.
                    CheckInCode = b.Status == "confirmed" || b.Status == "completed" ? b.CheckInCode : null,
                    AddOns = b.PurchasedAddOns.Select(a => new { a.Id, a.Name, a.Price }),
                    HasReviewed = _context.Reviews.Any(r => r.PropertyId == b.PropertyId && r.GuestId == guestId.Value)
                })
                .ToListAsync();

            return Ok(bookings);
        }
    }
}
