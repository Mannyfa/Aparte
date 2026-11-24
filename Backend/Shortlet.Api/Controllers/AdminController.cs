// Backend/Shortlet.Api/Controllers/AdminController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shortlet.Api.Helpers;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AdminController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AdminController(AppDbContext context)
        {
            _context = context;
        }

        // Checked against the database (not just the token) so a demoted admin loses access immediately.
        private async Task<bool> IsAdminAsync()
        {
            var userId = User.GetUserId();
            if (userId == null) return false;
            var role = await _context.Users.Where(u => u.Id == userId.Value).Select(u => u.Role).FirstOrDefaultAsync();
            return string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase);
        }

        // NOTE: Forbid("text") treats the text as an auth *scheme* name and throws — use a 403 result instead.
        private ObjectResult AccessDenied() => StatusCode(StatusCodes.Status403Forbidden, new { message = "Access denied: admin only." });

        [HttpGet("pending-kyc")]
        public async Task<IActionResult> GetPendingKyc()
        {
            if (!await IsAdminAsync()) return AccessDenied();

            var pendingHosts = await _context.Users
                .Where(u => u.VerificationStatus == "Pending")
                .Select(u => new
                {
                    id = u.Id,
                    name = u.Name,
                    email = u.Email,
                    phone = u.Phone,
                    documentUrl = u.IdDocumentUrl,
                    documentType = u.IdDocumentType,
                    submittedAt = u.CreatedAt
                })
                .ToListAsync();

            return Ok(pendingHosts);
        }

        [HttpPost("kyc/{hostId}/approve")]
        public async Task<IActionResult> ApproveKyc(Guid hostId)
        {
            if (!await IsAdminAsync()) return AccessDenied();

            var host = await _context.Users.FindAsync(hostId);
            if (host == null) return NotFound(new { message = "Host not found." });

            host.VerificationStatus = "Verified";
            host.IsVerified = true;
            await _context.SaveChangesAsync();
            return Ok(new { message = $"Success! {host.Name} is now a Premium Host." });
        }

        [HttpPost("kyc/{hostId}/reject")]
        public async Task<IActionResult> RejectKyc(Guid hostId)
        {
            if (!await IsAdminAsync()) return AccessDenied();

            var host = await _context.Users.FindAsync(hostId);
            if (host == null) return NotFound(new { message = "Host not found." });

            host.VerificationStatus = "Unverified";
            host.IsVerified = false;
            host.IdDocumentUrl = null;
            host.IdDocumentType = null;
            await _context.SaveChangesAsync();
            return Ok(new { message = $"Rejected. {host.Name} has been bumped back to Unverified." });
        }
    }
}
