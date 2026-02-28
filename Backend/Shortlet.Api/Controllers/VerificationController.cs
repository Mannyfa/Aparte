// Backend/Shortlet.Api/Controllers/VerificationController.cs
using System;
using System.Security.Claims;
using System.Threading.Tasks;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class VerificationController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly Cloudinary _cloudinary;

        public VerificationController(AppDbContext context, IConfiguration config)
        {
            _context = context;
            
            // This safely looks for your Cloudinary keys no matter how you named them in appsettings.json!
            var account = new Account(
                config["CloudinarySettings:CloudName"] ?? config["Cloudinary:CloudName"],
                config["CloudinarySettings:ApiKey"] ?? config["Cloudinary:ApiKey"],
                config["CloudinarySettings:ApiSecret"] ?? config["Cloudinary:ApiSecret"]
            );
            _cloudinary = new Cloudinary(account);
        }

        [HttpGet("status")]
        public async Task<IActionResult> GetStatus()
        {
            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier).Value);
            var user = await _context.Users.FindAsync(userId);
            
            return Ok(new { 
                status = user?.VerificationStatus ?? "Unverified",
                documentUrl = user?.IdDocumentUrl 
            });
        }

        [HttpPost("upload")]
        public async Task<IActionResult> UploadDocument(IFormFile document)
        {
            try
            {
                if (document == null || document.Length == 0)
                    return BadRequest(new { message = "No valid ID document detected." });

                var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier).Value);
                var user = await _context.Users.FindAsync(userId);

                // 1. Stream the file directly to Cloudinary
                using var stream = document.OpenReadStream();
                var uploadParams = new ImageUploadParams
                {
                    File = new FileDescription(document.FileName, stream),
                    Folder = "shortlet_kyc_documents"
                };

                var uploadResult = await _cloudinary.UploadAsync(uploadParams);

                if (uploadResult.Error != null)
                    return BadRequest(new { message = uploadResult.Error.Message });

                // 2. Save the URL and Update Status
                user.IdDocumentUrl = uploadResult.SecureUrl.ToString();
                
                // Note: In production, you might set this to "Pending" for Admin manual review. 
                // For this release, we will instantly verify them!
                user.VerificationStatus = "Verified"; 

                await _context.SaveChangesAsync();

                return Ok(new { message = "ID Document uploaded! You are now a Verified Host.", status = user.VerificationStatus });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error processing document." });
            }
        }
    }
}