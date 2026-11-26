using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shortlet.Api.Helpers;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Controllers
{
    [ApiController]
    [Route("api/host/statement")]
    [Authorize]
    public class HostStatementController : ControllerBase
    {
        private readonly AppDbContext _context;

        public HostStatementController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetStatement([FromQuery] string? month)
        {
            var hostId = User.GetUserId();
            if (hostId == null) return Unauthorized();

            if (!DateTime.TryParseExact(month ?? string.Empty, "yyyy-MM", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
                return BadRequest(new { message = "month must be in yyyy-MM format." });

            var start = new DateTime(parsed.Year, parsed.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var end = start.AddMonths(1);

            var rows = await _context.Bookings
                .Where(b => b.Property.HostId == hostId.Value && b.CheckIn >= start && b.CheckIn < end
                            && (b.Status == "paid" || b.Status == "confirmed" || b.Status == "completed"))
                .OrderBy(b => b.CheckIn)
                .Select(b => new
                {
                    Booking = b,
                    PropertyTitle = b.Property.Title,
                    GuestName = b.Guest.Name,
                    AddOnsTotal = b.PurchasedAddOns.Sum(a => (decimal?)a.Price) ?? 0m
                })
                .ToListAsync();

            var bookings = rows.Select(r => new
            {
                id = r.Booking.Id,
                propertyTitle = r.PropertyTitle,
                guestFirstName = (r.GuestName ?? string.Empty).Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? string.Empty,
                checkIn = r.Booking.CheckIn.ToString("yyyy-MM-dd"),
                checkOut = r.Booking.CheckOut.ToString("yyyy-MM-dd"),
                nights = (r.Booking.CheckOut - r.Booking.CheckIn).Days,
                hostEarnings = BookingMoney.HostEarnings(r.Booking, r.AddOnsTotal),
                status = r.Booking.Status
            }).ToList();

            return Ok(new
            {
                month = start.ToString("yyyy-MM"),
                bookingCount = bookings.Count,
                totalEarnings = bookings.Sum(x => x.hostEarnings),
                bookings
            });
        }
    }
}
