// Backend/Shortlet.Api/Controllers/PropertiesController.cs
using System.Text.Json;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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
        public string City { get; set; } = string.Empty;
        public string State { get; set; } = string.Empty;
        public string Area { get; set; } = string.Empty;
        public List<IFormFile>? Images { get; set; }
        public string? Amenities { get; set; }   // comma-separated from React
        public string? HouseRules { get; set; }  // comma-separated from React
        public string? AddOnsJson { get; set; }  // JSON array of { name, description, price }
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

        private readonly AppDbContext _context;
        private readonly Lazy<Cloudinary> _cloudinary;
        private readonly ILogger<PropertiesController> _logger;

        public PropertiesController(AppDbContext context, Lazy<Cloudinary> cloudinary, ILogger<PropertiesController> logger)
        {
            _context = context;
            _cloudinary = cloudinary;
            _logger = logger;
        }

        /// <summary>Listings visible to the public (everything except suspended ones).</summary>
        private IQueryable<Property> PublicProperties() => _context.Properties.Where(p => p.Status != "suspended");

        private static List<string> SplitList(string? csv) =>
            string.IsNullOrWhiteSpace(csv)
                ? new List<string>()
                : csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Distinct().ToList();

        [HttpPost]
        [Authorize]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> CreateProperty([FromForm] CreatePropertyFormData request)
        {
            var hostId = User.GetUserId();
            if (hostId == null) return Unauthorized();
            if (!User.HasRole("host")) return StatusCode(403, new { message = "Only host accounts can list properties." });

            if (string.IsNullOrWhiteSpace(request.Title)) return BadRequest(new { message = "Title is required." });
            if (string.IsNullOrWhiteSpace(request.City)) return BadRequest(new { message = "City is required." });
            if (request.PricePerNight <= 0) return BadRequest(new { message = "Price per night must be greater than zero." });
            if (request.CautionFee < 0) return BadRequest(new { message = "Caution fee can't be negative." });

            // --- ADD-ONS ---
            var parsedAddOns = new List<PropertyAddOn>();
            if (!string.IsNullOrWhiteSpace(request.AddOnsJson))
            {
                try
                {
                    var options = new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true,
                        NumberHandling = System.Text.Json.Serialization.JsonNumberHandling.AllowReadingFromString
                    };
                    var addOnList = JsonSerializer.Deserialize<List<AddOnRequestDto>>(request.AddOnsJson, options) ?? new();
                    parsedAddOns = addOnList
                        .Where(a => !string.IsNullOrWhiteSpace(a.Name) && a.Price >= 0)
                        .Select(a => new PropertyAddOn { Name = a.Name.Trim(), Description = a.Description?.Trim() ?? "", Price = a.Price })
                        .ToList();
                }
                catch (JsonException)
                {
                    return BadRequest(new { message = "Add-ons are not in a valid format." });
                }
            }

            // --- IMAGES (Cloudinary) ---
            var imageUrls = new List<string>();
            var images = (request.Images ?? new List<IFormFile>())
                .Where(i => i.Length > 0)
                .Take(MaxImages)
                .ToList();

            if (images.Any(i => i.Length > MaxImageBytes || !(i.ContentType?.StartsWith("image/") ?? false)))
                return BadRequest(new { message = "Images must be image files under 10 MB." });

            if (images.Count > 0)
            {
                Cloudinary cloudinary;
                try { cloudinary = _cloudinary.Value; }
                catch (InvalidOperationException ex)
                {
                    _logger.LogError(ex, "Cloudinary not configured");
                    return StatusCode(500, new { message = "Image uploads are not configured on the server." });
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
                        return BadRequest(new { message = $"Image upload failed: {result.Error.Message}" });
                    }
                    imageUrls.Add(result.SecureUrl.ToString());
                }
            }

            var property = new Property
            {
                HostId = hostId.Value,
                Title = request.Title.Trim(),
                Description = request.Description?.Trim() ?? "",
                Type = request.Type?.Trim() ?? "",
                PricePerNight = request.PricePerNight,
                CautionFee = request.CautionFee,
                City = request.City.Trim(),
                State = request.State?.Trim() ?? "",
                Area = request.Area?.Trim() ?? "",
                ImageUrls = imageUrls,
                Amenities = SplitList(request.Amenities),
                HouseRules = SplitList(request.HouseRules),
                AddOns = parsedAddOns,
                Status = "active" // there is no admin listing-approval flow yet; suspend via the Status column
            };

            _context.Properties.Add(property);
            await _context.SaveChangesAsync();

            return Ok(new { property.Id, property.Title, property.Status, property.ImageUrls });
        }

        private static IQueryable<object> Project(IQueryable<Property> query) => query.Select(p => new
        {
            p.Id, p.Title, p.Description, p.Type, p.PricePerNight,
            p.CautionFee,
            p.City, p.State, p.Area,
            p.ImageUrls,
            p.Amenities,
            p.HouseRules,
            AddOns = p.AddOns.Select(a => new { a.Id, a.Name, a.Description, a.Price }),
            HostName = p.Host != null ? p.Host.Name : "Unknown Host",
            HostVerificationStatus = p.Host != null ? p.Host.VerificationStatus : "Unverified"
        });

        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetProperties()
        {
            var properties = await Project(PublicProperties().OrderByDescending(p => p.CreatedAt)).ToListAsync();
            return Ok(properties);
        }

        [HttpGet("{id:guid}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetProperty(Guid id)
        {
            var property = await Project(PublicProperties().Where(p => p.Id == id)).FirstOrDefaultAsync();
            if (property == null) return NotFound(new { message = "Property not found." });
            return Ok(property);
        }

        [HttpGet("search")]
        [AllowAnonymous]
        public async Task<IActionResult> SearchProperties(
            [FromQuery] string? searchTerm, [FromQuery] string? type,
            [FromQuery] decimal? minPrice, [FromQuery] decimal? maxPrice,
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

            var totalItems = await query.CountAsync();
            var properties = await Project(query.OrderByDescending(p => p.CreatedAt).ThenBy(p => p.Id)
                    .Skip((page - 1) * pageSize).Take(pageSize))
                .ToListAsync();

            return Ok(new
            {
                Data = properties,
                CurrentPage = page,
                TotalPages = (int)Math.Ceiling(totalItems / (double)pageSize),
                TotalItems = totalItems
            });
        }

        [HttpGet("host")]
        [Authorize]
        public async Task<IActionResult> GetHostProperties()
        {
            var hostId = User.GetUserId();
            if (hostId == null) return Unauthorized();

            var properties = await Project(_context.Properties.Where(p => p.HostId == hostId.Value).OrderByDescending(p => p.CreatedAt))
                .ToListAsync();
            return Ok(properties);
        }

        [HttpGet("{id:guid}/booked-dates")]
        [AllowAnonymous]
        public async Task<IActionResult> GetBookedDates(Guid id)
        {
            var today = DateTime.UtcNow.Date;
            var bookings = await _context.Bookings
                .Where(b => b.PropertyId == id && b.CheckOut > today)
                .BlockingDates(_context, DateTime.UtcNow)
                .Select(b => new { b.CheckIn, b.CheckOut })
                .ToListAsync();

            // Block check-in day up to (not including) check-out day: a new guest can arrive on someone's check-out day.
            var bookedDates = new SortedSet<string>();
            foreach (var booking in bookings)
                for (var date = booking.CheckIn.Date; date < booking.CheckOut.Date; date = date.AddDays(1))
                    bookedDates.Add(date.ToString("yyyy-MM-dd"));

            return Ok(bookedDates);
        }
    }
}
