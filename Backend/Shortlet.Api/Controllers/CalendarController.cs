// Backend/Shortlet.Api/Controllers/CalendarController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shortlet.Api.Helpers;
using Shortlet.Api.Services;
using Shortlet.Core.Entities;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Controllers
{
    public class BlockDatesRequest
    {
        public DateTime StartDate { get; set; }  // first blocked night
        public DateTime EndDate { get; set; }    // day after the last blocked night (like a check-out date)
        public string? Note { get; set; }
    }

    public class AddFeedRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Url { get; set; } = string.Empty;
    }

    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CalendarController : ControllerBase
    {
        private const int MaxFeedsPerProperty = 5;
        private readonly AppDbContext _context;
        private readonly CalendarSyncService _sync;
        private readonly IConfiguration _config;

        public CalendarController(AppDbContext context, CalendarSyncService sync, IConfiguration config)
        {
            _context = context;
            _sync = sync;
            _config = config;
        }

        private Task<Property?> OwnPropertyAsync(Guid propertyId)
        {
            var hostId = User.GetUserId();
            return _context.Properties.FirstOrDefaultAsync(p => p.Id == propertyId && p.HostId == hostId && p.Status != "archived");
        }

        private string ExportUrl(string token)
        {
            var configured = _config["Api:PublicBaseUrl"];
            string baseUrl;
            if (!string.IsNullOrWhiteSpace(configured)) baseUrl = configured.TrimEnd('/');
            else
            {
                var host = Request.Host.Value ?? "localhost";
                var local = host.StartsWith("localhost") || host.StartsWith("127.0.0.1");
                baseUrl = $"{(local ? Request.Scheme : "https")}://{host}"; // Render terminates TLS in front of the app
            }
            return $"{baseUrl}/api/Calendar/export/{token}.ics";
        }

        // ------------------------------------------------------------------
        // Overview of one property's calendar
        // ------------------------------------------------------------------

        [HttpGet("property/{propertyId:guid}")]
        public async Task<IActionResult> GetPropertyCalendar(Guid propertyId)
        {
            var property = await OwnPropertyAsync(propertyId);
            if (property == null) return NotFound(new { message = "Listing not found." });

            if (property.CalendarToken == null)
            {
                property.CalendarToken = CalendarSyncService.NewToken();
                await _context.SaveChangesAsync();
            }

            var today = DateTime.UtcNow.Date;
            var now = DateTime.UtcNow;
            var bookings = await _context.Bookings
                .Where(b => b.PropertyId == propertyId && b.CheckOut > today)
                .BlockingDates(_context, now)
                .OrderBy(b => b.CheckIn)
                .Select(b => new { b.Id, Start = b.CheckIn, End = b.CheckOut, b.Status, GuestName = b.Guest.Name })
                .ToListAsync();

            var feeds = await _context.CalendarFeeds.Where(f => f.PropertyId == propertyId).OrderBy(f => f.CreatedAt)
                .Select(f => new { f.Id, f.Name, f.Url, f.LastSyncedAt, f.LastError, f.EventCount })
                .ToListAsync();
            var feedNames = feeds.ToDictionary(f => f.Id, f => f.Name);

            var blocks = (await _context.PropertyCalendars
                    .Where(c => c.PropertyId == propertyId && c.BookingId == null && c.EndDate > today)
                    .OrderBy(c => c.StartDate)
                    .Select(c => new { c.Id, Start = c.StartDate, End = c.EndDate, c.Source, c.Note, c.FeedId })
                    .ToListAsync())
                .Select(c => new { c.Id, c.Start, c.End, c.Source, c.Note, FeedName = c.FeedId != null && feedNames.TryGetValue(c.FeedId.Value, out var n) ? n : null });

            return Ok(new { propertyId, property.Title, exportUrl = ExportUrl(property.CalendarToken!), bookings, blocks, feeds });
        }

        // ------------------------------------------------------------------
        // Host blocks
        // ------------------------------------------------------------------

        [HttpPost("property/{propertyId:guid}/blocks")]
        public async Task<IActionResult> BlockDates(Guid propertyId, [FromBody] BlockDatesRequest request)
        {
            var property = await OwnPropertyAsync(propertyId);
            if (property == null) return NotFound(new { message = "Listing not found." });

            var start = BookingRules.ToUtcDate(request.StartDate);
            var end = BookingRules.ToUtcDate(request.EndDate);
            if (end <= start) return BadRequest(new { message = "Choose at least one night to block." });
            if (end <= DateTime.UtcNow.Date) return BadRequest(new { message = "Those dates are in the past." });
            if ((end - start).TotalDays > 366) return BadRequest(new { message = "Block at most a year at a time." });

            var now = DateTime.UtcNow;
            var clashes = await _context.Bookings
                .Where(b => b.PropertyId == propertyId && b.CheckIn < end && b.CheckOut > start)
                .BlockingDates(_context, now)
                .AnyAsync();
            if (clashes) return Conflict(new { message = "Some of those nights are already booked by a guest." });

            var block = new PropertyCalendar
            {
                PropertyId = propertyId,
                StartDate = start,
                EndDate = end,
                Source = "host",
                Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim()[..Math.Min(request.Note.Trim().Length, 120)]
            };
            _context.PropertyCalendars.Add(block);
            await _context.SaveChangesAsync();
            PropertiesController.InvalidatePublicCache();
            return Ok(new { block.Id, message = "Dates blocked." });
        }

        [HttpDelete("blocks/{blockId:guid}")]
        public async Task<IActionResult> UnblockDates(Guid blockId)
        {
            var hostId = User.GetUserId();
            var block = await _context.PropertyCalendars
                .FirstOrDefaultAsync(c => c.Id == blockId && c.Source == "host" && c.Property.HostId == hostId);
            if (block == null) return NotFound(new { message = "Blocked dates not found." });

            _context.PropertyCalendars.Remove(block);
            await _context.SaveChangesAsync();
            PropertiesController.InvalidatePublicCache();
            return Ok(new { message = "Dates unblocked." });
        }

        // ------------------------------------------------------------------
        // Imported calendars (Airbnb, Booking.com, …)
        // ------------------------------------------------------------------

        [HttpPost("property/{propertyId:guid}/feeds")]
        public async Task<IActionResult> AddFeed(Guid propertyId, [FromBody] AddFeedRequest request)
        {
            var property = await OwnPropertyAsync(propertyId);
            if (property == null) return NotFound(new { message = "Listing not found." });

            var urlError = CalendarSyncService.ValidateFeedUrl(request.Url);
            if (urlError != null) return BadRequest(new { message = urlError });
            if (await _context.CalendarFeeds.CountAsync(f => f.PropertyId == propertyId) >= MaxFeedsPerProperty)
                return BadRequest(new { message = $"A listing can sync with at most {MaxFeedsPerProperty} calendars." });

            var url = request.Url.Trim();
            if (await _context.CalendarFeeds.AnyAsync(f => f.PropertyId == propertyId && f.Url == url))
                return Conflict(new { message = "That calendar is already connected." });

            var feed = new CalendarFeed
            {
                PropertyId = propertyId,
                Name = string.IsNullOrWhiteSpace(request.Name) ? "External calendar" : request.Name.Trim()[..Math.Min(request.Name.Trim().Length, 40)],
                Url = url
            };
            _context.CalendarFeeds.Add(feed);
            await _context.SaveChangesAsync();

            var (ok, message) = await _sync.SyncFeedAsync(feed);
            PropertiesController.InvalidatePublicCache();
            return Ok(new { feed.Id, synced = ok, message = ok ? message : $"Calendar saved, but the first sync failed: {message}" });
        }

        [HttpPost("feeds/{feedId:guid}/sync")]
        public async Task<IActionResult> SyncFeed(Guid feedId)
        {
            var hostId = User.GetUserId();
            var feed = await _context.CalendarFeeds.FirstOrDefaultAsync(f => f.Id == feedId &&
                _context.Properties.Any(p => p.Id == f.PropertyId && p.HostId == hostId));
            if (feed == null) return NotFound(new { message = "Calendar not found." });

            var (ok, message) = await _sync.SyncFeedAsync(feed);
            PropertiesController.InvalidatePublicCache();
            return ok ? Ok(new { message }) : BadRequest(new { message });
        }

        [HttpDelete("feeds/{feedId:guid}")]
        public async Task<IActionResult> RemoveFeed(Guid feedId)
        {
            var hostId = User.GetUserId();
            var feed = await _context.CalendarFeeds.FirstOrDefaultAsync(f => f.Id == feedId &&
                _context.Properties.Any(p => p.Id == f.PropertyId && p.HostId == hostId));
            if (feed == null) return NotFound(new { message = "Calendar not found." });

            await _context.PropertyCalendars.Where(c => c.FeedId == feedId).ExecuteDeleteAsync();
            _context.CalendarFeeds.Remove(feed);
            await _context.SaveChangesAsync();
            PropertiesController.InvalidatePublicCache();
            return Ok(new { message = $"{feed.Name} disconnected. Its dates are open again." });
        }

        /// <summary>Issues a new export link (the old one stops working), e.g. if it was shared by mistake.</summary>
        [HttpPost("property/{propertyId:guid}/export-link/reset")]
        public async Task<IActionResult> ResetExportLink(Guid propertyId)
        {
            var property = await OwnPropertyAsync(propertyId);
            if (property == null) return NotFound(new { message = "Listing not found." });
            property.CalendarToken = CalendarSyncService.NewToken();
            await _context.SaveChangesAsync();
            return Ok(new { exportUrl = ExportUrl(property.CalendarToken), message = "New export link created. Update it on the other sites." });
        }

        // ------------------------------------------------------------------
        // Public .ics export (Airbnb / Booking.com poll this)
        // ------------------------------------------------------------------

        [HttpGet("export/{token}.ics")]
        [AllowAnonymous]
        public async Task<IActionResult> Export(string token)
        {
            if (string.IsNullOrWhiteSpace(token) || token.Length < 20) return NotFound();
            var property = await _context.Properties.FirstOrDefaultAsync(p => p.CalendarToken == token && p.Status != "archived");
            if (property == null) return NotFound();

            var ics = await _sync.BuildExportAsync(property);
            Response.Headers.CacheControl = "no-cache";
            return File(System.Text.Encoding.UTF8.GetBytes(ics), "text/calendar; charset=utf-8", "apartey.ics");
        }

        // Kept for older dashboard builds: accepted-booking ranges across all the host's listings.
        [HttpGet("host")]
        public async Task<IActionResult> GetHostCalendar()
        {
            var hostId = User.GetUserId();
            if (hostId == null) return Unauthorized();
            var blocked = await _context.PropertyCalendars
                .Where(c => c.Property.HostId == hostId.Value)
                .Select(c => new { propertyId = c.PropertyId, propertyTitle = c.Property.Title, startDate = c.StartDate, endDate = c.EndDate, source = c.Source })
                .ToListAsync();
            return Ok(blocked);
        }
    }
}
