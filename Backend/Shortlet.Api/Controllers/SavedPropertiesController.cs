// Backend/Shortlet.Api/Controllers/SavedPropertiesController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shortlet.Api.Helpers;
using Shortlet.Core.Entities;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Controllers
{
    [ApiController]
    [Route("api/saved")]
    [Authorize]
    public class SavedPropertiesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SavedPropertiesController(AppDbContext context) => _context = context;

        [HttpGet]
        public async Task<IActionResult> GetSaved()
        {
            var myId = User.GetUserId();
            if (myId == null) return Unauthorized();

            var items = await _context.SavedProperties
                .Where(s => s.UserId == myId.Value)
                .Join(_context.Properties.Where(p => p.Status == "active"), s => s.PropertyId, p => p.Id,
                    (s, p) => new { s, p })
                .OrderByDescending(x => x.s.CreatedAt)
                .Select(x => new
                {
                    id = x.p.Id,
                    title = x.p.Title,
                    city = x.p.City,
                    area = x.p.Area,
                    pricePerNight = x.p.PricePerNight,
                    imageUrl = x.p.ImageUrls.FirstOrDefault(),
                    savedAt = x.s.CreatedAt
                })
                .ToListAsync();

            return Ok(items);
        }

        [HttpGet("ids")]
        public async Task<IActionResult> GetIds()
        {
            var myId = User.GetUserId();
            if (myId == null) return Unauthorized();

            var ids = await _context.SavedProperties
                .Where(s => s.UserId == myId.Value)
                .Select(s => s.PropertyId)
                .ToListAsync();
            return Ok(ids);
        }

        [HttpPost("{propertyId:guid}")]
        public async Task<IActionResult> Save(Guid propertyId)
        {
            var myId = User.GetUserId();
            if (myId == null) return Unauthorized();

            var exists = await _context.Properties.AnyAsync(p => p.Id == propertyId && p.Status == "active");
            if (!exists) return NotFound(new { message = "Listing not found." });

            var already = await _context.SavedProperties.AnyAsync(s => s.UserId == myId.Value && s.PropertyId == propertyId);
            if (!already)
            {
                _context.SavedProperties.Add(new SavedProperty { UserId = myId.Value, PropertyId = propertyId });
                try { await _context.SaveChangesAsync(); }
                catch (DbUpdateException) { /* unique-index race: it was saved by a parallel request */ }
            }

            return Ok(new { saved = true });
        }

        [HttpDelete("{propertyId:guid}")]
        public async Task<IActionResult> Unsave(Guid propertyId)
        {
            var myId = User.GetUserId();
            if (myId == null) return Unauthorized();

            await _context.SavedProperties
                .Where(s => s.UserId == myId.Value && s.PropertyId == propertyId)
                .ExecuteDeleteAsync();

            return Ok(new { saved = false });
        }
    }
}
