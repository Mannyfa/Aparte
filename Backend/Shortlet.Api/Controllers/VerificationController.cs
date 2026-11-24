// Backend/Shortlet.Api/Controllers/VerificationController.cs
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shortlet.Api.Helpers;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Controllers
{
    /// <summary>
    /// Swashbuckle can't describe a bare [FromForm] IFormFile parameter (it crashed /swagger),
    /// so the upload is bound to this class instead.
    /// </summary>
    public class KycUploadRequest
    {
        public IFormFile? Document { get; set; }
        public string DocumentType { get; set; } = string.Empty;
    }

    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class VerificationController : ControllerBase
    {
        private static readonly string[] AllowedDocumentTypes = { "NIN", "Passport", "DriversLicense", "VotersCard" };
        private const long MaxDocumentBytes = 10 * 1024 * 1024;

        private readonly AppDbContext _context;
        private readonly Lazy<Cloudinary> _cloudinary;
        private readonly ILogger<VerificationController> _logger;

        public VerificationController(AppDbContext context, Lazy<Cloudinary> cloudinary, ILogger<VerificationController> logger)
        {
            _context = context;
            _cloudinary = cloudinary;
            _logger = logger;
        }

        [HttpGet("status")]
        public async Task<IActionResult> GetStatus()
        {
            var userId = User.GetUserId();
            if (userId == null) return Unauthorized();

            var user = await _context.Users.FindAsync(userId.Value);
            return Ok(new
            {
                status = user?.VerificationStatus ?? "Unverified",
                documentUrl = user?.IdDocumentUrl
            });
        }

        [HttpPost("upload")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadDocument([FromForm] KycUploadRequest request)
        {
            var document = request.Document;
            if (document == null || document.Length == 0)
                return BadRequest(new { message = "No valid ID document detected." });
            if (document.Length > MaxDocumentBytes)
                return BadRequest(new { message = "Document must be under 10 MB." });

            var contentType = document.ContentType ?? "";
            if (!contentType.StartsWith("image/") && contentType != "application/pdf")
                return BadRequest(new { message = "Upload an image or a PDF." });

            var documentType = AllowedDocumentTypes.FirstOrDefault(t => string.Equals(t, request.DocumentType, StringComparison.OrdinalIgnoreCase))
                ?? request.DocumentType?.Trim();
            if (string.IsNullOrEmpty(documentType)) return BadRequest(new { message = "Choose a document type." });

            var userId = User.GetUserId();
            if (userId == null) return Unauthorized();
            var user = await _context.Users.FindAsync(userId.Value);
            if (user == null) return NotFound(new { message = "User not found." });
            if (user.VerificationStatus == "Verified") return BadRequest(new { message = "You are already verified." });

            Cloudinary cloudinary;
            try { cloudinary = _cloudinary.Value; }
            catch (InvalidOperationException ex)
            {
                _logger.LogError(ex, "Cloudinary not configured");
                return StatusCode(500, new { message = "Document uploads are not configured on the server." });
            }

            await using var stream = document.OpenReadStream();
            var uploadResult = await cloudinary.UploadAsync(new RawUploadParams
            {
                File = new FileDescription(document.FileName, stream),
                Folder = "shortlet_kyc_documents"
            });

            if (uploadResult.Error != null)
                return BadRequest(new { message = uploadResult.Error.Message });

            user.IdDocumentUrl = uploadResult.SecureUrl.ToString();
            user.IdDocumentType = documentType;
            user.VerificationStatus = "Pending";
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Verification request submitted successfully! Our team is reviewing it.",
                status = user.VerificationStatus,
                documentUrl = user.IdDocumentUrl
            });
        }
    }
}
