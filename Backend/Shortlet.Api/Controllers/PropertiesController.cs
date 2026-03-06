// Backend/Shortlet.Api/Controllers/PropertiesController.cs
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Shortlet.Core.Entities;
using Shortlet.Infrastructure.Data;
using System.Text.Json;

namespace Shortlet.Api.Controllers
{
    // DTO defined here for simplicity so you don't have to hunt for it!
    public class CreatePropertyFormData
    {
        public string Title { get; set; }
        public string Description { get; set; }
        public string Type { get; set; }
        public decimal PricePerNight { get; set; }
        public string City { get; set; }
        public string State { get; set; }
        public string Area { get; set; }
        public List<IFormFile>? Images { get; set; }
        public string? Amenities { get; set; } // Sent as comma-separated from React
        public string? HouseRules { get; set; } // Sent as comma-separated from React
        
        // NEW: Accepts a JSON string of AddOns from React
        public string? AddOnsJson { get; set; } 
    }

    // Quick helper class for deserializing the AddOns from React
    public class AddOnRequestDto 
    {
        public string Name { get; set; }
        public string Description { get; set; }
        public decimal Price { get; set; }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class PropertiesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly Cloudinary _cloudinary;

        public PropertiesController(AppDbContext context, IConfiguration config)
        {
            _context = context;
            
            // 1. Try to read from appsettings.json
            var cloudName = config["CloudinarySettings:CloudName"];
            var apiKey = config["CloudinarySettings:ApiKey"];
            var apiSecret = config["CloudinarySettings:ApiSecret"];

            // 2. If .NET fails to read the file (returns null), use these hardcoded keys instead!
            if (string.IsNullOrEmpty(cloudName))
            {
                cloudName = "dr79cponz"; 
                apiKey = "371983351852516";       
                apiSecret = "eib4KCH5JjMHtSDb3vv_8ldg-Mo";
            }

            var account = new Account(cloudName, apiKey, apiSecret);
            _cloudinary = new Cloudinary(account);
        }

        [HttpPost]
        [Authorize]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> CreateProperty([FromForm] CreatePropertyFormData request)
        {
            try
            {
                var hostId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier).Value);

                var imageUrls = new List<string>();

                // --- CLOUDINARY MULTI-UPLOAD MAGIC ---
                if (request.Images != null && request.Images.Count > 0)
                {
                    // Limit to 5 images max
                    foreach (var image in request.Images.Take(5))
                    {
                        using var stream = image.OpenReadStream();
                        var uploadParams = new ImageUploadParams
                        {
                            File = new FileDescription(image.FileName, stream),
                            Folder = "apartey_properties"
                        };
                        var result = await _cloudinary.UploadAsync(uploadParams);
                        if (result.Error == null) imageUrls.Add(result.SecureUrl.ToString());
                    }
                }

                // --- PARSE THE ADD-ONS ---
                var parsedAddOns = new List<PropertyAddOn>();
                if (!string.IsNullOrEmpty(request.AddOnsJson))
                {
                    // FIX: Tell C# to allow numbers to be wrapped in quotes!
                    var jsonOptions = new JsonSerializerOptions 
                    { 
                        PropertyNameCaseInsensitive = true,
                        NumberHandling = System.Text.Json.Serialization.JsonNumberHandling.AllowReadingFromString
                    };

                    var addOnList = JsonSerializer.Deserialize<List<AddOnRequestDto>>(request.AddOnsJson, jsonOptions);
                    if (addOnList != null)
                    {
                        foreach (var a in addOnList)
                        {
                            parsedAddOns.Add(new PropertyAddOn { Name = a.Name, Description = a.Description, Price = a.Price });
                        }
                    }
                }

                var property = new Property
                {
                    HostId = hostId,
                    Title = request.Title,
                    Description = request.Description,
                    Type = request.Type,
                    PricePerNight = request.PricePerNight,
                    City = request.City,
                    State = request.State,
                    Area = request.Area,
                    ImageUrls = imageUrls,
                    
                    CautionFee = string.IsNullOrEmpty(Request.Form["cautionFee"]) ? 0 : decimal.Parse(Request.Form["cautionFee"]),

                    // Convert comma-separated strings back into real Lists!
                    Amenities = string.IsNullOrEmpty(request.Amenities) ? new List<string>() : request.Amenities.Split(',').ToList(),
                    HouseRules = string.IsNullOrEmpty(request.HouseRules) ? new List<string>() : request.HouseRules.Split(',').ToList(),
                    AddOns = parsedAddOns // Attach the AddOns!
                };

                _context.Properties.Add(property);
                await _context.SaveChangesAsync();

                return Ok(property);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetProperties()
        {
            var properties = await _context.Properties.Include(p => p.Host).Include(p => p.AddOns).OrderByDescending(p => p.Id).Select(p => new {
                p.Id, p.Title, p.Description, p.Type, p.PricePerNight, 
                p.CautionFee, // <-- REVEALING ESCROW FEE TO FRONTEND!
                p.City, p.State, p.Area,
                ImageUrls = p.ImageUrls,
                Amenities = p.Amenities,
                HouseRules = p.HouseRules,
                AddOns = p.AddOns,
                HostName = p.Host != null ? p.Host.Name : "Unknown Host",
                HostVerificationStatus = p.Host != null ? p.Host.VerificationStatus : "Unverified"
            }).ToListAsync();
            return Ok(properties);
        }

        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetProperty(Guid id)
        {
            var property = await _context.Properties
                .Include(p => p.Host)
                .Include(p => p.AddOns) // Load the AddOns from the DB
                .Select(p => new {
                    p.Id, p.Title, p.Description, p.Type, p.PricePerNight, 
                    p.CautionFee, // <-- REVEALING ESCROW FEE TO FRONTEND!
                    p.City, p.State, p.Area,
                    ImageUrls = p.ImageUrls,
                    Amenities = p.Amenities,
                    HouseRules = p.HouseRules,
                    AddOns = p.AddOns, // Send them to React
                    HostName = p.Host != null ? p.Host.Name : "Unknown Host",
                    HostVerificationStatus = p.Host != null ? p.Host.VerificationStatus : "Unverified"
                }).FirstOrDefaultAsync(p => p.Id == id);

            if (property == null) return NotFound();
            return Ok(property);
        }

        [HttpGet("search")]
        [AllowAnonymous]
        public async Task<IActionResult> SearchProperties([FromQuery] string? searchTerm, [FromQuery] string? type, [FromQuery] decimal? minPrice, [FromQuery] decimal? maxPrice, [FromQuery] int page = 1, [FromQuery] int pageSize = 6) 
        {
            var query = _context.Properties.AsQueryable();
            if (!string.IsNullOrWhiteSpace(searchTerm)) query = query.Where(p => p.Title.ToLower().Contains(searchTerm.ToLower()) || p.City.ToLower().Contains(searchTerm.ToLower()) || p.Area.ToLower().Contains(searchTerm.ToLower()));
            if (!string.IsNullOrWhiteSpace(type)) query = query.Where(p => p.Type == type);
            if (minPrice.HasValue) query = query.Where(p => p.PricePerNight >= minPrice.Value);
            if (maxPrice.HasValue) query = query.Where(p => p.PricePerNight <= maxPrice.Value);

            var totalItems = await query.CountAsync();
            var properties = await query.Include(p => p.Host).Include(p => p.AddOns).OrderByDescending(p => p.Id).Skip((page - 1) * pageSize).Take(pageSize).Select(p => new {
                p.Id, p.Title, p.Description, p.Type, p.PricePerNight, 
                p.CautionFee, // <-- REVEALING ESCROW FEE TO FRONTEND!
                p.City, p.State, p.Area,
                ImageUrls = p.ImageUrls,
                Amenities = p.Amenities,
                HouseRules = p.HouseRules,
                AddOns = p.AddOns,
                HostName = p.Host != null ? p.Host.Name : "Unknown Host",
                HostVerificationStatus = p.Host != null ? p.Host.VerificationStatus : "Unverified"
            }).ToListAsync();

            return Ok(new { Data = properties, CurrentPage = page, TotalPages = (int)Math.Ceiling(totalItems / (double)pageSize), TotalItems = totalItems });
        }

        [HttpGet("host")]
        [Authorize]
        public async Task<IActionResult> GetHostProperties()
        {
            var hostId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier).Value);
            // Including AddOns here too just in case the Host Dashboard needs to display them later!
            var properties = await _context.Properties.Include(p => p.AddOns).Where(p => p.HostId == hostId).OrderByDescending(p => p.Id).ToListAsync();
            return Ok(properties);
        }
    }
}