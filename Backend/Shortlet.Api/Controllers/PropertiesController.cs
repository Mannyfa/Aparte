// Backend/Shortlet.Api/Controllers/PropertiesController.cs
using System.Text.Json;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Shortlet.Api.Helpers;
using Shortlet.Core.Entities;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Controllers
{
    public class CreatePropertyFormData
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public decimal PricePerNight { get; set; }
        public decimal CautionFee { get; set; }
        public decimal? WeekendPricePerNight { get; set; }
        public int MinNights { get; set; } = 1;
        public string City { get; set; } = string.Empty;
        public string State { get; set; } = string.Empty;
        public string Area { get; set; } = string.Empty;
        public List<IFormFile>? Images { get; set; }
        public string? Amenities { get; set; }   // comma-separated from React
        public string? HouseRules { get; set; }  // comma-separated from React
        public string? AddOnsJson { get; set; }  // JSON array of { name, description, price }

        /// <summary>Edit only: JSON array of existing photo URLs to keep, in display order.</summary>
        public string? KeepImageUrlsJson { get; set; }
    }

    public class AddOnRequestDto
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public decimal Price { get; set; }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class PropertiesController : ControllerBase
    {
        private const int MaxImages = 5;
        private const long MaxImageBytes = 10 * 1024 * 1024;
        public const int UnverifiedListingLimit = 2;

        /// <summary>Public listing data is cached briefly; any listing change bumps this so caches refresh at once.</summary>
        private static int _listingsVersion;
        private static readonly TimeSpan PublicCacheTtl = TimeSpan.FromSeconds(30);

        /// <summary>Call after anything that changes what guests see (listing edits, blocked dates, reviews).</summary>
        public static void InvalidatePublicCache() => Interlocked.Increment(ref _listingsVersion);

        private readonly AppDbContext _context;
        private readonly Lazy<Cloudinary> _cloudinary;
        private readonly IMemoryCache _cache;
        private readonly ILogger<PropertiesController> _logger;

        public PropertiesController(AppDbContext context, Lazy<Cloudinary> cloudinary, IMemoryCache cache, ILogger<PropertiesController> logger)
        {
            _context = context;
            _cloudinary = cloudinary;
            _cache = cache;
            _logger = logger;
        }

        private static string CacheKey(string name) => $"listings:v{Volatile.Read(ref _listingsVersion)}:{name}";

        private Task<T> Cached<T>(string name, Func<Task<T>> load) =>
            _cache.GetOrCreateAsync(CacheKey(name), entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = PublicCacheTtl;
                return load();
            })!;

        /// <summary>Listings visible to guests: not suspended by an admin, not deleted by the host.</summary>
        private IQueryable<Property> PublicProperties() => _context.Properties.Where(p => p.Status != "suspended" && p.Status != "archived");

        private static List<string> SplitList(string? csv) =>
            string.IsNullOrWhiteSpace(csv)
                ? new List<string>()
                : csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Distinct().ToList();

        // ------------------------------------------------------------------
        // Shared form handling for create + edit
        // ------------------------------------------------------------------

        private static string? Validate(CreatePropertyFormData r)
        {
            if (string.IsNullOrWhiteSpace(r.Title)) return "Title is required.";
            if (r.Title.Trim().Length > 120) return "Keep the title under 120 characters.";
            if (string.IsNullOrWhiteSpace(r.City)) return "City is required.";
            if (r.PricePerNight <= 0) return "Price per night must be greater than zero.";
            if (r.CautionFee < 0) return "Caution fee can't be negative.";
            if (r.WeekendPricePerNight is <= 0) return "Weekend price must be greater than zero.";
            if (r.MinNights < 1 || r.MinNights > 90) return "Minimum stay must be between 1 and 90 nights.";
            return null;
        }

        private static (List<PropertyAddOn>? AddOns, string? Error) ParseAddOns(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return (new List<PropertyAddOn>(), null);
            try
            {
                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true,
                    NumberHandling = System.Text.Json.Serialization.JsonNumberHandling.AllowReadingFromString
                };
                var list = JsonSerializer.Deserialize<List<AddOnRequestDto>>(json, options) ?? new();
                return (list
                    .Where(a => !string.IsNullOrWhiteSpace(a.Name) && a.Price >= 0)
                    .Select(a => new PropertyAddOn { Name = a.Name.Trim(), Description = a.Description?.Trim() ?? "", Price = a.Price })
                    .ToList(), null);
            }
            catch (JsonException)
            {
                return (null, "Add-ons are not in a valid format.");
            }
        }

        /// <summary>Uploads new photos to Cloudinary. Returns the URLs, or an error result.</summary>
        private async Task<(List<string> Urls, IActionResult? Error)> UploadImagesAsync(List<IFormFile> images)
        {
            var urls = new List<string>();
            if (images.Count == 0) return (urls, null);

            if (images.Any(i => i.Length > MaxImageBytes || !(i.ContentType?.StartsWith("image/") ?? false)))
                return (urls, BadRequest(new { message = "Images must be image files under 10 MB." }));

            Cloudinary cloudinary;
            try { cloudinary = _cloudinary.Value; }
            catch (InvalidOperationException ex)
            {
                _logger.LogError(ex, "Cloudinary not configured");
                return (urls, StatusCode(500, new { message = "Image uploads are not configured on the server." }));
            }

            foreach (var image in images)
            {
                await using var stream = image.OpenReadStream();
                var result = await cloudinary.UploadAsync(new ImageUploadParams
                {
                    File = new FileDescription(image.FileName, stream),
                    Folder = "apartey_properties"
                });
                if (result.Error != null)
                {
                    _logger.LogWarning("Cloudinary upload failed: {Error}", result.Error.Message);
                    return (urls, BadRequest(new { message = $"Image upload failed: {result.Error.Message}" }));
                }
                urls.Add(result.SecureUrl.ToString());
            }
            return (urls, null);
        }

        // ------------------------------------------------------------------
        // Create / edit / delete (hosts)
        // ------------------------------------------------------------------

        [HttpPost]
        [Authorize]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> CreateProperty([FromForm] CreatePropertyFormData request)
        {
            var hostId = User.GetUserId();
            if (hostId == null) return Unauthorized();
            if (!User.HasRole("host")) return StatusCode(403, new { message = "Only host accounts can list properties." });

            var error = Validate(request);
            if (error != null) return BadRequest(new { message = error });

            // Unverified hosts can have a limited number of live listings (the app shows the same rule).
            var verified = await _context.Users.Where(u => u.Id == hostId.Value).Select(u => u.VerificationStatus).FirstOrDefaultAsync() == "Verified";
            if (!verified)
            {
                var live = await _context.Properties.CountAsync(p => p.HostId == hostId.Value && p.Status != "archived");
                if (live >= UnverifiedListingLimit)
                    return StatusCode(403, new { message = $"Unverified hosts can list {UnverifiedListingLimit} properties. Verify your ID to list more." });
            }

            var (addOns, addOnError) = ParseAddOns(request.AddOnsJson);
            if (addOnError != null) return BadRequest(new { message = addOnError });

            var images = (request.Images ?? new()).Where(i => i.Length > 0).Take(MaxImages).ToList();
            var (imageUrls, uploadError) = await UploadImagesAsync(images);
            if (uploadError != null) return uploadError;

            var property = new Property
            {
                HostId = hostId.Value,
                Title = request.Title.Trim(),
                Description = request.Description?.Trim() ?? "",
                Type = request.Type?.Trim() ?? "",
                PricePerNight = request.PricePerNight,
                CautionFee = request.CautionFee,
                WeekendPricePerNight = request.WeekendPricePerNight,
                MinNights = request.MinNights,
                City = request.City.Trim(),
                State = request.State?.Trim() ?? "",
                Area = request.Area?.Trim() ?? "",
                ImageUrls = imageUrls,
                Amenities = SplitList(request.Amenities),
                HouseRules = SplitList(request.HouseRules),
                AddOns = addOns!,
                Status = "active" // there is no admin listing-approval flow yet; suspend via the Status column
            };

            _context.Properties.Add(property);
            await _context.SaveChangesAsync();
            InvalidatePublicCache();

            return Ok(new { property.Id, property.Title, property.Status, property.ImageUrls });
        }

        [HttpPut("{id:guid}")]
        [Authorize]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UpdateProperty(Guid id, [FromForm] CreatePropertyFormData request)
        {
            var hostId = User.GetUserId();
            if (hostId == null) return Unauthorized();

            var property = await _context.Properties.Include(p => p.AddOns)
                .FirstOrDefaultAsync(p => p.Id == id && p.HostId == hostId.Value && p.Status != "archived");
            if (property == null) return NotFound(new { message = "Listing not found." });

            var error = Validate(request);
            if (error != null) return BadRequest(new { message = error });

            var (addOns, addOnError) = ParseAddOns(request.AddOnsJson);
            if (addOnError != null) return BadRequest(new { message = addOnError });

            // Photos: keep the ones the host didn't remove (only URLs that already belong to this listing), then add new uploads.
            List<string> keep;
            try
            {
                keep = string.IsNullOrWhiteSpace(request.KeepImageUrlsJson)
                    ? new List<string>(property.ImageUrls)
                    : (JsonSerializer.Deserialize<List<string>>(request.KeepImageUrlsJson) ?? new()).Where(property.ImageUrls.Contains).Distinct().ToList();
            }
            catch (JsonException)
            {
                return BadRequest(new { message = "Photo list is not in a valid format." });
            }

            var newImages = (request.Images ?? new()).Where(i => i.Length > 0).Take(Math.Max(0, MaxImages - keep.Count)).ToList();
            var (uploaded, uploadError) = await UploadImagesAsync(newImages);
            if (uploadError != null) return uploadError;

            property.Title = request.Title.Trim();
            property.Description = request.Description?.Trim() ?? "";
            property.Type = request.Type?.Trim() ?? "";
            property.PricePerNight = request.PricePerNight;   // existing bookings keep the price they were charged
            property.CautionFee = request.CautionFee;
            property.WeekendPricePerNight = request.WeekendPricePerNight;
            property.MinNights = request.MinNights;
            property.City = request.City.Trim();
            property.State = request.State?.Trim() ?? "";
            property.Area = request.Area?.Trim() ?? "";
            property.ImageUrls = keep.Concat(uploaded).Take(MaxImages).ToList();
            property.Amenities = SplitList(request.Amenities);
            property.HouseRules = SplitList(request.HouseRules);

            // Add-ons are replaced. Past bookings are unaffected: they store a snapshot of name and price.
            _context.PropertyAddOns.RemoveRange(property.AddOns);
            foreach (var a in addOns!) { a.PropertyId = property.Id; _context.PropertyAddOns.Add(a); }

            await _context.SaveChangesAsync();
            InvalidatePublicCache();
            return Ok(new { property.Id, property.Title, property.ImageUrls, message = "Listing updated." });
        }

        /// <summary>
        /// Removes a listing from Apartey. Listings with upcoming or in-progress bookings can't be deleted.
        /// The record is archived rather than erased so past bookings, payouts and reviews keep their history.
        /// </summary>
        [HttpDelete("{id:guid}")]
        [Authorize]
        public async Task<IActionResult> DeleteProperty(Guid id)
        {
            var hostId = User.GetUserId();
            if (hostId == null) return Unauthorized();

            var property = await _context.Properties.FirstOrDefaultAsync(p => p.Id == id && p.HostId == hostId.Value && p.Status != "archived");
            if (property == null) return NotFound(new { message = "Listing not found." });

            var now = DateTime.UtcNow;
            var hasActiveBookings = await _context.Bookings
                .Where(b => b.PropertyId == id && b.CheckOut > now)
                .BlockingDates(_context, now)
                .AnyAsync();
            if (hasActiveBookings)
                return Conflict(new { message = "This listing has upcoming bookings. Cancel or complete them before deleting it." });

            var heldDeposits = await _context.Bookings.AnyAsync(b => b.PropertyId == id && (b.CautionFeeStatus == "Held" || b.CautionFeeStatus == "Releasing"));
            if (heldDeposits)
                return Conflict(new { message = "A guest's caution fee is still in escrow for this listing. Settle it first." });

            property.Status = "archived";
            property.CalendarToken = null; // stop the iCal export
            _context.CalendarFeeds.RemoveRange(_context.CalendarFeeds.Where(f => f.PropertyId == id));
            _context.PropertyCalendars.RemoveRange(_context.PropertyCalendars.Where(c => c.PropertyId == id && c.BookingId == null));
            await _context.SaveChangesAsync();
            InvalidatePublicCache();
            return Ok(new { message = "Listing deleted." });
        }

        // ------------------------------------------------------------------
        // Reading listings
        // ------------------------------------------------------------------

        private IQueryable<object> Project(IQueryable<Property> query) => query.Select(p => new
        {
            p.Id, p.Title, p.Description, p.Type, p.PricePerNight,
            p.CautionFee,
            HostId = p.HostId,
            p.WeekendPricePerNight,
            p.MinNights,
            PriceRules = _context.PriceRules.Where(r => r.PropertyId == p.Id).OrderBy(r => r.StartDate)
                .Select(r => new PriceRuleDto { Id = r.Id, StartDate = r.StartDate, EndDate = r.EndDate, NightlyPrice = r.NightlyPrice, Label = r.Label })
                .ToList(),
            p.City, p.State, p.Area,
            p.ImageUrls,
            p.Amenities,
            p.HouseRules,
            p.Status,
            AddOns = p.AddOns.Select(a => new { a.Id, a.Name, a.Description, a.Price }),
            HostName = p.Host != null ? p.Host.Name : "Unknown Host",
            HostVerificationStatus = p.Host != null ? p.Host.VerificationStatus : "Unverified",
            Rating = _context.Reviews.Where(r => r.PropertyId == p.Id).Average(r => (double?)r.Rating),
            ReviewCount = _context.Reviews.Count(r => r.PropertyId == p.Id)
        });

        /// <summary>Just what a listing card / map pin needs: no description, rules, amenities or add-ons (no join).</summary>
        private IQueryable<object> ProjectCard(IQueryable<Property> query) => query.Select(p => new
        {
            p.Id, p.Title, p.Type, p.PricePerNight,
            p.City, p.State, p.Area,
            p.ImageUrls,
            HostVerificationStatus = p.Host != null ? p.Host.VerificationStatus : "Unverified",
            Rating = _context.Reviews.Where(r => r.PropertyId == p.Id).Average(r => (double?)r.Rating),
            ReviewCount = _context.Reviews.Count(r => r.PropertyId == p.Id)
        });

        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetProperties()
        {
            var properties = await Cached("all", () =>
                ProjectCard(PublicProperties().OrderByDescending(p => p.CreatedAt)).AsNoTracking().ToListAsync());
            return Ok(properties);
        }

        [HttpGet("{id:guid}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetProperty(Guid id)
        {
            var property = await Cached($"one:{id}", () =>
                Project(PublicProperties().Where(p => p.Id == id)).AsNoTracking().FirstOrDefaultAsync());
            if (property == null) return NotFound(new { message = "Property not found." });
            Response.Headers.CacheControl = "public, max-age=30";
            return Ok(property);
        }

        [HttpGet("search")]
        [AllowAnonymous]
        public async Task<IActionResult> SearchProperties(
            [FromQuery] string? searchTerm, [FromQuery] string? type,
            [FromQuery] decimal? minPrice, [FromQuery] decimal? maxPrice,
            [FromQuery] DateTime? checkIn, [FromQuery] DateTime? checkOut,
            [FromQuery] int page = 1, [FromQuery] int pageSize = 6)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 50);

            var query = PublicProperties();
            if (!string.IsNullOrWhiteSpace(searchTerm))
            {
                var pattern = "%" + searchTerm.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_") + "%";
                query = query.Where(p => EF.Functions.ILike(p.Title, pattern) || EF.Functions.ILike(p.City, pattern) || EF.Functions.ILike(p.Area, pattern));
            }
            if (!string.IsNullOrWhiteSpace(type)) query = query.Where(p => p.Type == type);
            if (minPrice.HasValue) query = query.Where(p => p.PricePerNight >= minPrice.Value);
            if (maxPrice.HasValue) query = query.Where(p => p.PricePerNight <= maxPrice.Value);

            // Only places that are free for the whole stay (bookings, host blocks and imported calendars all count).
            string datesKey = "";
            if (checkIn.HasValue && checkOut.HasValue)
            {
                var ci = BookingRules.ToUtcDate(checkIn.Value);
                var co = BookingRules.ToUtcDate(checkOut.Value);
                if (co <= ci) return BadRequest(new { message = "Check-out must be after check-in." });
                var unavailable = BookingRules.UnavailablePropertyIds(_context, ci, co, DateTime.UtcNow);
                query = query.Where(p => !unavailable.Contains(p.Id));
                datesKey = $"{ci:yyyyMMdd}-{co:yyyyMMdd}";
            }

            var cacheName = $"search:{searchTerm?.Trim().ToLowerInvariant()}|{type}|{minPrice}|{maxPrice}|{datesKey}|{page}|{pageSize}";
            var result = await Cached(cacheName, async () =>
            {
                var properties = await ProjectCard(query.OrderByDescending(p => p.CreatedAt).ThenBy(p => p.Id)
                        .Skip((page - 1) * pageSize).Take(pageSize))
                    .AsNoTracking()
                    .ToListAsync();

                // A short first page already tells us the total: skip the second round trip to the database.
                var totalItems = page == 1 && properties.Count < pageSize
                    ? properties.Count
                    : await query.CountAsync();

                return new
                {
                    Data = properties,
                    CurrentPage = page,
                    TotalPages = (int)Math.Ceiling(totalItems / (double)pageSize),
                    TotalItems = totalItems
                };
            });

            Response.Headers.CacheControl = "public, max-age=15";
            return Ok(result);
        }

        [HttpGet("host")]
        [Authorize]
        public async Task<IActionResult> GetHostProperties()
        {
            var hostId = User.GetUserId();
            if (hostId == null) return Unauthorized();

            var properties = await Project(_context.Properties
                    .Where(p => p.HostId == hostId.Value && p.Status != "archived")
                    .OrderByDescending(p => p.CreatedAt))
                .ToListAsync();
            return Ok(properties);
        }

        /// <summary>Unavailable nights for the date picker: bookings, host blocks and imported calendars.</summary>
        [HttpGet("{id:guid}/booked-dates")]
        [AllowAnonymous]
        public async Task<IActionResult> GetBookedDates(Guid id)
        {
            var today = DateTime.UtcNow.Date;
            var ranges = await _context.Bookings
                .Where(b => b.PropertyId == id && b.CheckOut > today)
                .BlockingDates(_context, DateTime.UtcNow)
                .Select(b => new { Start = b.CheckIn, End = b.CheckOut })
                .ToListAsync();

            var blocks = await _context.PropertyCalendars
                .Where(c => c.PropertyId == id && c.BookingId == null && c.EndDate > today)
                .Select(c => new { Start = c.StartDate, End = c.EndDate })
                .ToListAsync();

            // Block check-in day up to (not including) check-out day: a new guest can arrive on someone's check-out day.
            var bookedDates = new SortedSet<string>();
            foreach (var r in ranges.Concat(blocks))
                for (var date = r.Start.Date; date < r.End.Date; date = date.AddDays(1))
                    if (date >= today) bookedDates.Add(date.ToString("yyyy-MM-dd"));

            return Ok(bookedDates);
        }
    }
}
