using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shortlet.Api.Helpers;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Controllers
{
    [ApiController]
    [Route("api/receipts")]
    [Authorize]
    public class ReceiptsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ReceiptsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("{bookingId}")]
        public async Task<IActionResult> GetReceipt(Guid bookingId)
        {
            var userId = User.GetUserId();
            if (userId == null) return Unauthorized();

            var b = await _context.Bookings
                .Include(x => x.Property).ThenInclude(p => p.Host)
                .Include(x => x.Guest)
                .Include(x => x.PurchasedAddOns)
                .FirstOrDefaultAsync(x => x.Id == bookingId);
            if (b == null) return NotFound(new { message = "Receipt not found." });

            var role = await _context.Users.Where(u => u.Id == userId.Value).Select(u => u.Role).FirstOrDefaultAsync();
            var isAdmin = string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase);
            if (!isAdmin && b.GuestId != userId.Value && b.Property.HostId != userId.Value)
                return NotFound(new { message = "Receipt not found." });

            var addOnsTotal = b.PurchasedAddOns.Sum(a => a.Price);
            return Ok(new
            {
                id = b.Id,
                reference = b.PaymentReference,
                status = b.Status,
                createdAt = b.CreatedAt,
                propertyTitle = b.Property.Title,
                hostName = b.Property.Host.Name,
                guestName = b.Guest.Name,
                checkIn = b.CheckIn.ToString("yyyy-MM-dd"),
                checkOut = b.CheckOut.ToString("yyyy-MM-dd"),
                nights = (b.CheckOut - b.CheckIn).Days,
                roomAmount = BookingMoney.RoomAmount(b, addOnsTotal),
                platformFee = b.ServiceFee,
                promoDiscount = b.PromoDiscount,
                creditApplied = b.CreditApplied,
                addOns = b.PurchasedAddOns.Select(a => new { name = a.Name, price = a.Price }),
                cautionFee = b.CautionFeeAmount,
                total = b.TotalPrice,
                currency = "NGN"
            });
        }
    }
}
