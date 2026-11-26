// Backend/Shortlet.Api/Controllers/HostBookingsController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Shortlet.Api.Helpers;
using Shortlet.Api.Hubs;
using Shortlet.Api.Services;
using Shortlet.Core.Entities;
using Shortlet.Core.Interfaces;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Controllers
{
    public class CautionClaimRequest
    {
        public decimal Amount { get; set; }
        public string Reason { get; set; } = string.Empty;
    }

    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class HostBookingsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly BookingFinanceService _finance;
        private readonly IEmailQueue _emailQueue;
        private readonly IHubContext<ChatHub> _hubContext;

        public HostBookingsController(AppDbContext context, BookingFinanceService finance, IEmailQueue emailQueue, IHubContext<ChatHub> hubContext)
        {
            _context = context;
            _finance = finance;
            _emailQueue = emailQueue;
            _hubContext = hubContext;
        }

        [HttpGet]
        public async Task<IActionResult> GetHostBookings()
        {
            var hostId = User.GetUserId();
            if (hostId == null) return Unauthorized();

            var bookings = await _context.Bookings
                .Where(b => b.Property.HostId == hostId.Value && b.Status != "failed")
                .OrderByDescending(b => b.CreatedAt)
                .Select(b => new
                {
                    id = b.Id,
                    propertyTitle = b.Property.Title,
                    totalPrice = b.TotalPrice,
                    cautionFee = b.CautionFeeAmount, // held in escrow; not part of the host's payout
                    cautionFeeStatus = b.CautionFeeStatus,
                    cautionClaimAmount = b.CautionClaimAmount,
                    cautionClaimReason = b.CautionClaimReason,
                    status = b.Status,
                    checkInCode = b.Status == "confirmed" || b.Status == "completed" ? b.CheckInCode : null,
                    checkIn = b.CheckIn,
                    checkOut = b.CheckOut,
                    guestName = b.Guest.Name,
                    guestPhone = b.Guest.Phone,
                    addOns = b.PurchasedAddOns.Select(a => new { a.Id, a.Name, a.Price })
                })
                .ToListAsync();

            var window = _finance.CautionClaimWindow;
            var now = DateTime.UtcNow;
            return Ok(bookings.Select(b => new
            {
                b.id, b.propertyTitle, b.totalPrice, b.cautionFee, b.cautionFeeStatus, b.cautionClaimAmount, b.cautionClaimReason,
                b.status, b.checkInCode, b.checkIn, b.checkOut, b.guestName, b.guestPhone, b.addOns,
                // The host can return or claim the deposit from check-out day until the deadline.
                cautionDeadline = b.cautionFeeStatus == "Held" ? b.checkOut + window : (DateTime?)null,
                canResolveCaution = b.cautionFeeStatus == "Held" && (b.status is "confirmed" or "completed")
                                    && now >= b.checkOut.Date && now < b.checkOut + window
            }));
        }

        /// <summary>Loads a booking only if it belongs to one of the caller's properties.</summary>
        private async Task<Booking?> FindOwnBookingAsync(Guid bookingId)
        {
            var hostId = User.GetUserId();
            if (hostId == null) return null;
            return await _context.Bookings
                .Include(b => b.Property)
                .Include(b => b.Guest)
                .FirstOrDefaultAsync(b => b.Id == bookingId && b.Property.HostId == hostId.Value);
        }

        [HttpPost("{id}/accept")]
        public async Task<IActionResult> AcceptBooking(Guid id)
        {
            var booking = await FindOwnBookingAsync(id);
            if (booking == null) return NotFound(new { message = "Booking not found." });
            if (booking.Status != "paid")
                return BadRequest(new { message = $"Only paid bookings can be accepted (this one is '{booking.Status}')." });

            booking.Status = "confirmed";
            booking.CheckInCode ??= BookingRules.NewCheckInCode();

            _context.PropertyCalendars.Add(new PropertyCalendar
            {
                PropertyId = booking.PropertyId,
                BookingId = booking.Id,
                StartDate = booking.CheckIn,
                EndDate = booking.CheckOut
            });

            await _context.SaveChangesAsync();

            await _emailQueue.QueueEmailAsync(new EmailMessagePayload
            {
                ToEmail = booking.Guest.Email,
                Subject = $"Booking Confirmed: {booking.Property.Title}",
                Body = $"<h1>Your booking is confirmed!</h1><p>Hi {System.Net.WebUtility.HtmlEncode(booking.Guest.Name)},</p>" +
                       $"<p>Your host has approved your stay at <strong>{System.Net.WebUtility.HtmlEncode(booking.Property.Title)}</strong>.</p>" +
                       $"<h2>Check-in code: {booking.CheckInCode}</h2><p>Show this code to security on arrival.</p>"
            });

            await _hubContext.Clients.Group(booking.GuestId.ToString()).SendAsync("ReceiveNotification", new
            {
                title = "Booking Accepted! 🎉",
                message = $"Your stay at {booking.Property.Title} was just approved. Check your trips for the gate code!"
            });

            return Ok(new { message = "Booking Confirmed!", code = booking.CheckInCode });
        }

        [HttpPost("{id}/reject")]
        public async Task<IActionResult> RejectBooking(Guid id)
        {
            var booking = await FindOwnBookingAsync(id);
            if (booking == null) return NotFound(new { message = "Booking not found." });

            if (booking.Status is not ("paid" or "split_pending" or "pending"))
                return BadRequest(new { message = booking.Status == "confirmed"
                    ? "Confirmed bookings can't be declined here. Contact support to cancel."
                    : $"This booking is already '{booking.Status}'." });

            var allAccepted = await _finance.CancelAndRefundAsync(
                booking.Id, "rejected", "Host declined the booking",
                $"Your host couldn't accept your dates for {booking.Property.Title}.");

            await _hubContext.Clients.Group(booking.GuestId.ToString()).SendAsync("ReceiveNotification", new
            {
                title = "Booking Declined",
                message = $"The host couldn't accept your dates for {booking.Property.Title}. Any payment is being refunded."
            });

            return Ok(new
            {
                message = allAccepted
                    ? "Booking declined. Any payment is being refunded to the guest."
                    : "Booking declined. A refund couldn't be sent yet and will be retried automatically."
            });
        }

        // =================================================================
        // CAUTION FEE: return it, or keep some/all for damage
        // =================================================================

        private async Task<(Booking? Booking, IActionResult? Error)> LoadCautionBookingAsync(Guid id)
        {
            var booking = await FindOwnBookingAsync(id);
            if (booking == null) return (null, NotFound(new { message = "Booking not found." }));
            if (booking.CautionFeeStatus != "Held")
                return (null, BadRequest(new { message = booking.CautionFeeAmount <= 0 ? "This booking has no caution fee." : $"The caution fee is already {booking.CautionFeeStatus.ToLowerInvariant()}." }));
            if (booking.Status is not ("confirmed" or "completed"))
                return (null, BadRequest(new { message = "The caution fee can only be settled for confirmed stays." }));

            var now = DateTime.UtcNow;
            if (now < booking.CheckOut.Date)
                return (null, BadRequest(new { message = "You can settle the caution fee from the check-out day." }));
            if (now >= _finance.CautionDeadline(booking))
                return (null, BadRequest(new { message = "The claim window has closed; the caution fee is being returned to the guest." }));
            return (booking, null);
        }

        [HttpPost("{id}/caution/release")]
        public async Task<IActionResult> ReleaseCaution(Guid id)
        {
            var (booking, error) = await LoadCautionBookingAsync(id);
            if (error != null) return error;

            var (ok, message) = await _finance.ResolveCautionAsync(booking!.Id, 0, null);
            return ok ? Ok(new { message }) : BadRequest(new { message });
        }

        [HttpPost("{id}/caution/claim")]
        public async Task<IActionResult> ClaimCaution(Guid id, [FromBody] CautionClaimRequest request)
        {
            var (booking, error) = await LoadCautionBookingAsync(id);
            if (error != null) return error;

            var reason = request.Reason?.Trim() ?? string.Empty;
            if (request.Amount <= 0) return BadRequest(new { message = "Enter the amount you're keeping." });
            if (request.Amount > booking!.CautionFeeAmount)
                return BadRequest(new { message = $"You can keep at most ₦{booking.CautionFeeAmount:N0}." });
            if (reason.Length < 10) return BadRequest(new { message = "Describe the damage (at least 10 characters) so the guest knows why." });
            if (reason.Length > 500) return BadRequest(new { message = "Keep the reason under 500 characters." });

            var (ok, message) = await _finance.ResolveCautionAsync(booking.Id, request.Amount, reason);
            if (ok)
            {
                await _hubContext.Clients.Group(booking.GuestId.ToString()).SendAsync("ReceiveNotification", new
                {
                    title = "Caution fee update",
                    message = $"Your host kept ₦{request.Amount:N0} of your caution fee for {booking.Property.Title}."
                });
            }
            return ok ? Ok(new { message }) : BadRequest(new { message });
        }
    }
}
