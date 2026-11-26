using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shortlet.Api.Helpers;
using Shortlet.Core.Entities;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Controllers
{
    /// <summary>Writes a calendar day as "yyyy-MM-dd".</summary>
    public class DayOnlyJsonConverter : JsonConverter<DateTime>
    {
        public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
            DateTime.Parse(reader.GetString()!, System.Globalization.CultureInfo.InvariantCulture);

        public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options) =>
            writer.WriteStringValue(value.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture));
    }

    public class PriceRuleDto
    {
        public Guid Id { get; set; }
        [JsonConverter(typeof(DayOnlyJsonConverter))] public DateTime StartDate { get; set; }
        [JsonConverter(typeof(DayOnlyJsonConverter))] public DateTime EndDate { get; set; }
        public decimal NightlyPrice { get; set; }
        public string? Label { get; set; }
    }

    public class CreatePriceRuleRequest
    {
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public decimal NightlyPrice { get; set; }
        public string? Label { get; set; }
    }

    [ApiController]
    [Route("api/properties/{propertyId:guid}/price-rules")]
    public class PriceRulesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PriceRulesController(AppDbContext context) => _context = context;

        private static PriceRuleDto ToDto(PriceRule r) => new()
        {
            Id = r.Id, StartDate = r.StartDate, EndDate = r.EndDate, NightlyPrice = r.NightlyPrice, Label = r.Label
        };

        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetRules(Guid propertyId)
        {
            var rules = await _context.PriceRules.Where(r => r.PropertyId == propertyId)
                .OrderBy(r => r.StartDate).AsNoTracking().ToListAsync();
            return Ok(rules.Select(ToDto));
        }

        [HttpPost]
        [Authorize]
        public async Task<IActionResult> CreateRule(Guid propertyId, [FromBody] CreatePriceRuleRequest request)
        {
            var userId = User.GetUserId();
            if (userId == null) return Unauthorized();

            var property = await _context.Properties.AsNoTracking().FirstOrDefaultAsync(p => p.Id == propertyId && p.Status != "archived");
            if (property == null) return NotFound(new { message = "Listing not found." });
            if (property.HostId != userId.Value) return StatusCode(403, new { message = "You can only edit pricing for your own listings." });

            var start = BookingRules.ToUtcDate(request.StartDate);
            var end = BookingRules.ToUtcDate(request.EndDate);
            if (end < start) return BadRequest(new { message = "End date can't be before the start date." });
            if (request.NightlyPrice <= 0) return BadRequest(new { message = "Nightly price must be greater than zero." });

            var overlaps = await _context.PriceRules.AnyAsync(r => r.PropertyId == propertyId && r.StartDate <= end && r.EndDate >= start);
            if (overlaps) return BadRequest(new { message = "These dates overlap an existing price rule." });

            var label = request.Label?.Trim();
            var rule = new PriceRule
            {
                PropertyId = propertyId, StartDate = start, EndDate = end,
                NightlyPrice = request.NightlyPrice, Label = string.IsNullOrEmpty(label) ? null : label
            };
            _context.PriceRules.Add(rule);
            await _context.SaveChangesAsync();
            PropertiesController.InvalidatePublicCache();
            return Ok(ToDto(rule));
        }

        [HttpDelete("{ruleId:guid}")]
        [Authorize]
        public async Task<IActionResult> DeleteRule(Guid propertyId, Guid ruleId)
        {
            var userId = User.GetUserId();
            if (userId == null) return Unauthorized();

            var property = await _context.Properties.AsNoTracking().FirstOrDefaultAsync(p => p.Id == propertyId);
            if (property == null) return NotFound(new { message = "Listing not found." });
            if (property.HostId != userId.Value) return StatusCode(403, new { message = "You can only edit pricing for your own listings." });

            var rule = await _context.PriceRules.FirstOrDefaultAsync(r => r.Id == ruleId && r.PropertyId == propertyId);
            if (rule == null) return NotFound(new { message = "Price rule not found." });

            _context.PriceRules.Remove(rule);
            await _context.SaveChangesAsync();
            PropertiesController.InvalidatePublicCache();
            return NoContent();
        }
    }
}
