// Backend/Shortlet.Api/Controllers/PropertiesController.cs
using System;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shortlet.Core.DTOs;
using Shortlet.Core.Interfaces;

namespace Shortlet.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PropertiesController : ControllerBase
    {
        private readonly IPropertyService _propertyService;

        public PropertiesController(IPropertyService propertyService)
        {
            _propertyService = propertyService;
        }

        [HttpPost]
        [Authorize] // MUST be logged in to post a property
        [Consumes("multipart/form-data")] // Required for file uploads
        public async Task<IActionResult> CreateProperty([FromForm] CreatePropertyDto request)
        {
            try
            {
                // Extract the User ID from the JWT Token
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userIdClaim)) return Unauthorized();

                var hostId = Guid.Parse(userIdClaim);

                var property = await _propertyService.CreatePropertyAsync(hostId, request);
                return Ok(property);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet]
        [AllowAnonymous] // Anyone can view the listings, even without logging in!
        public async Task<IActionResult> GetProperties()
        {
            try
            {
                var properties = await _propertyService.GetAllActivePropertiesAsync();
                return Ok(properties);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}