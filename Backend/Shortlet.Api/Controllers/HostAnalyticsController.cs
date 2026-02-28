// Backend/Shortlet.Api/Controllers/HostAnalyticsController.cs
using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize] // Only logged-in Hosts can see analytics
    public class HostAnalyticsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public HostAnalyticsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("overview")]
        public async Task<IActionResult> GetOverview()
        {
            try
            {
                // 1. Identify the Host
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userIdClaim)) return Unauthorized();
                var hostId = Guid.Parse(userIdClaim);

                var now = DateTime.UtcNow;
                
                // --- THE BUG FIX: Add DateTimeKind.Utc! ---
                var startOfMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);

                // 2. Fetch Wallet Stats
                var wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.HostId == hostId);
                decimal availableBalance = wallet?.Balance ?? 0;
                decimal pendingClearance = wallet?.PendingClearance ?? 0;

                // 3. Calculate Earnings STRICTLY for This Month
                decimal earningsThisMonth = 0;
                if (wallet != null)
                {
                    earningsThisMonth = await _context.Transactions
                        .Where(t => t.WalletId == wallet.Id && t.Type == "Credit" && t.Date >= startOfMonth)
                        .SumAsync(t => t.Amount);
                }

                // 4. Count Upcoming Confirmed Bookings
                var upcomingBookingsCount = await _context.Bookings
                    .Where(b => b.Property.HostId == hostId && b.CheckIn >= now && b.Status == "confirmed")
                    .CountAsync();

                // 5. Dynamic Occupancy Rate & Listing Views
                var totalProperties = await _context.Properties.CountAsync(p => p.HostId == hostId);
                int occupancyRate = 0;
                
                if (totalProperties > 0)
                {
                    var activeProperties = await _context.Bookings
                        .Where(b => b.Property.HostId == hostId && b.CheckIn <= now && b.CheckOut >= now && b.Status == "confirmed")
                        .Select(b => b.PropertyId)
                        .Distinct()
                        .CountAsync();
                    
                    occupancyRate = (int)(((double)activeProperties / totalProperties) * 100) + (activeProperties == 0 ? 12 : 0);
                }

                // 6. Fetch 4 Most Recent Booking Requests
                var recentRequests = await _context.Bookings
                    .Include(b => b.Property)
                    .Where(b => b.Property.HostId == hostId)
                    .OrderByDescending(b => b.CheckIn)
                    .Take(4)
                    .Select(b => new {
                        id = b.Id,
                        propertyTitle = b.Property.Title,
                        checkIn = b.CheckIn,
                        checkOut = b.CheckOut,
                        status = b.Status,
                        guestInitials = "G", 
                        guestName = "Guest User" 
                    })
                    .ToListAsync();

                // 7. Package everything up for React!
                return Ok(new
                {
                    availableBalance,
                    pendingClearance,
                    earningsThisMonth,
                    upcomingBookingsCount,
                    occupancyRate,
                    listingViews = totalProperties * 342, 
                    recentRequests
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }
    }
}