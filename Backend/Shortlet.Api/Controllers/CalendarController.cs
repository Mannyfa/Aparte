// Backend/Shortlet.Api/Controllers/CalendarController.cs
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
    public class CalendarController : ControllerBase
    {
        private readonly AppDbContext _context;

        public CalendarController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("host")]
        public async Task<IActionResult> GetHostCalendar()
        {
            try
            {
                var hostId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier).Value);

                // Fetch all confirmed blocking dates for this host's properties
                var blockedDates = await _context.PropertyCalendars
                    .Include(c => c.Property)
                    .Where(c => c.Property.HostId == hostId)
                    .Select(c => new {
                        propertyId = c.PropertyId,
                        propertyTitle = c.Property.Title,
                        startDate = c.StartDate,
                        endDate = c.EndDate
                    })
                    .ToListAsync();

                return Ok(blockedDates);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }
    }
}