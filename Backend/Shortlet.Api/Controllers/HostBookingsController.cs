// Backend/Shortlet.Api/Controllers/HostBookingsController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Shortlet.Api.Helpers;
using Shortlet.Api.Hubs;
using Shortlet.Core.Entities;
using Shortlet.Core.Interfaces;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class HostBookingsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IPaystackService _paystack;
        private readonly IEmailQueue _emailQueue;
        private readonly IHubContext<ChatHub> _hubContext;
        private readonly ILogger<HostBookingsController> _logger;

        public HostBookingsController(
            AppDbContext context,
            IPaystackService paystack,
            IEmailQueue emailQueue,
            IHubContext<ChatHub> hubContext,
            ILogger<HostBookingsController> logger)
        {
            _context = context;
            _paystack = paystack;
            _emailQueue = emailQueue;
            _hubContext = hubContext;
            _logger = logger;
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
                    status = b.Status,
                    checkInCode = b.Status == "confirmed" || b.Status == "completed" ? b.CheckInCode : null,
                    checkIn = b.CheckIn,
                    checkOut = b.CheckOut,
                    guestName = b.Guest.Name,
                    guestPhone = b.Guest.Phone,
                    addOns = b.PurchasedAddOns.Select(a => new { a.Id, a.Name, a.Price })
                })
                .ToListAsync();

            return Ok(bookings);
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

            if (booking.Status is "rejected" or "cancelled" or "completed" or "failed")
                return BadRequest(new { message = $"This booking is already '{booking.Status}'." });
            if (booking.Status == "confirmed")
                return BadRequest(new { message = "Confirmed bookings can't be rejected here. Contact support to cancel." });

            var refunded = false;
            if (booking.Status is "paid" or "split_pending")
            {
                // 1. Refund every payment that funded this booking (one for solo, one per friend for splits,
                //    including friends who already paid into a split that isn't complete yet).
                var references = await _context.SplitShares
                    .Where(s => s.SplitGroup.BookingId == booking.Id && s.Status == "Paid")
                    .Select(s => s.PaymentReference)
                    .ToListAsync();
                if (references.Count == 0 && booking.Status == "paid") references.Add(booking.PaymentReference);

                foreach (var reference in references)
                {
                    var (success, message) = await _paystack.RefundAsync(reference);
                    if (!success)
                    {
                        _logger.LogError("Refund of {Reference} for booking {BookingId} failed: {Message}", reference, booking.Id, message);
                        return StatusCode(502, new { message = $"Paystack refund failed: {message}. The booking was not changed." });
                    }
                }
                refunded = references.Count > 0;

                var splitGroup = await _context.SplitGroups.FirstOrDefaultAsync(sg => sg.BookingId == booking.Id);
                if (splitGroup != null) splitGroup.Status = "Cancelled";

                // 2. Reverse exactly what the webhook credited to the host.
                await using var tx = await _context.Database.BeginTransactionAsync();
                var credited = await _context.Transactions
                    .Where(t => t.Reference == booking.Id.ToString() && t.Type == "Credit")
                    .SumAsync(t => t.Amount);

                if (credited > 0)
                {
                    var wallet = await WalletLedger.LockWalletAsync(_context, booking.Property.HostId);
                    wallet.Balance -= credited;
                    wallet.UpdatedAt = DateTime.UtcNow;
                    _context.Transactions.Add(new Transaction
                    {
                        WalletId = wallet.Id,
                        Amount = credited,
                        Type = "Debit",
                        Description = "Refund for rejected booking",
                        Reference = booking.Id + "_refund"
                    });
                }

                if (booking.CautionFeeAmount > 0) booking.CautionFeeStatus = "Refunded";
                booking.Status = "rejected";
                await _context.SaveChangesAsync();
                await tx.CommitAsync();
            }
            else
            {
                booking.Status = "rejected"; // unpaid / split still collecting: nothing to refund yet
                await _context.SaveChangesAsync();
            }

            await _hubContext.Clients.Group(booking.GuestId.ToString()).SendAsync("ReceiveNotification", new
            {
                title = "Booking Declined",
                message = refunded
                    ? $"The host couldn't accept your dates for {booking.Property.Title}. A full refund has been issued."
                    : $"The host couldn't accept your dates for {booking.Property.Title}."
            });

            return Ok(new { message = refunded ? "Booking rejected. Guest has been refunded." : "Booking rejected." });
        }
    }
}
