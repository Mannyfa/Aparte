// Backend/Shortlet.Api/Controllers/AdminController.cs
using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize] // We will check for the exact Admin role inside the methods!
    public class AdminController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AdminController(AppDbContext context)
        {
            _context = context;
        }

        // Helper to ensure the person clicking the button is actually the CEO
        private async Task<bool> IsAdminAsync()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim)) return false;

            var user = await _context.Users.FindAsync(Guid.Parse(userIdClaim));
            return user != null && user.Role.ToLower() == "admin";
        }

        // 1. Fetch all Hosts waiting for KYC Approval
        [HttpGet("pending-kyc")]
        public async Task<IActionResult> GetPendingKyc()
        {
            if (!await IsAdminAsync()) return Forbid("Access Denied: God Mode Required.");

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
                    submittedAt = u.CreatedAt // You could add a specific submitted date later!
                })
                .ToListAsync();

            return Ok(pendingHosts);
        }

        // 2. Approve a Host
        [HttpPost("kyc/{hostId}/approve")]
        public async Task<IActionResult> ApproveKyc(Guid hostId)
        {
            if (!await IsAdminAsync()) return Forbid("Access Denied.");

            var host = await _context.Users.FindAsync(hostId);
            if (host == null) return NotFound("Host not found.");

            host.VerificationStatus = "Verified";
            await _context.SaveChangesAsync();

            return Ok(new { message = $"Success! {host.Name} is now a Premium Host." });
        }

        // 3. Reject a Host (If the ID is blurry or fake)
        [HttpPost("kyc/{hostId}/reject")]
        public async Task<IActionResult> RejectKyc(Guid hostId)
        {
            if (!await IsAdminAsync()) return Forbid("Access Denied.");

            var host = await _context.Users.FindAsync(hostId);
            if (host == null) return NotFound("Host not found.");

            host.VerificationStatus = "Unverified";
            // Optional: You could wipe the Document URL here to force a fresh upload
            host.IdDocumentUrl = null; 
            
            await _context.SaveChangesAsync();

            return Ok(new { message = $"Rejected. {host.Name} has been bumped back to Unverified." });
        }
    }
}