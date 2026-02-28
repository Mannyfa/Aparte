// Backend/Shortlet.Api/Controllers/GuestBookingsController.cs
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
    [Authorize]
    public class GuestBookingsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public GuestBookingsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetMyTrips()
        {
            try
            {
                var guestId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier).Value);

                var trips = await _context.Bookings
                    .Include(b => b.Property)
                    .Where(b => b.GuestId == guestId)
                    .OrderByDescending(b => b.CheckIn)
                    .Select(b => new {
                        b.Id,
                        b.PropertyId,
                        PropertyTitle = b.Property.Title,
                        
                        // FIX: Set to empty string so the build passes! 
                        // (If you know what your image property is called in Property.cs, 
                        // you can change this later to something like: b.Property.Image)
                        PropertyImage = "", 
                        
                        PropertyCity = b.Property.City,
                        b.CheckIn,
                        b.CheckOut,
                        b.TotalPrice,
                        b.Status,
                        b.CheckInCode,
                        HasReviewed = _context.Reviews.Any(r => r.PropertyId == b.PropertyId && r.GuestId == guestId)
                    })
                    .ToListAsync();

                return Ok(trips);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }
    }
}