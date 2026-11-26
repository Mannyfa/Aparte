// Backend/Shortlet.Api/Controllers/AuthController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shortlet.Api.Helpers;
using Shortlet.Api.Services;
using Shortlet.Core.DTOs;
using Shortlet.Core.Interfaces;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Controllers
{
    public class ForgotPasswordRequest { public string Email { get; set; } = string.Empty; }
    public class ResetPasswordRequest { public string Token { get; set; } = string.Empty; public string Password { get; set; } = string.Empty; }
    public class VerifyEmailRequest { public string Token { get; set; } = string.Empty; }

    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;
        private readonly AccountTokenService _tokens;
        private readonly AppDbContext _context;
        private readonly ILogger<AuthController> _logger;

        public AuthController(IAuthService authService, AccountTokenService tokens, AppDbContext context, ILogger<AuthController> logger)
        {
            _authService = authService;
            _tokens = tokens;
            _context = context;
            _logger = logger;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterDto request)
        {
            try
            {
                var result = await _authService.RegisterAsync(request);
                var user = await _context.Users.FindAsync(result.UserId);
                if (user != null) await _tokens.SendVerificationAsync(user);
                return Ok(result);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Registration failed");
                return StatusCode(500, new { message = "Registration failed. Please try again." });
            }
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto request)
        {
            try
            {
                return Ok(await _authService.LoginAsync(request));
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Login failed");
                return StatusCode(500, new { message = "Login failed. Please try again." });
            }
        }

        /// <summary>The signed-in user's current profile (role, email status) — the app refreshes its session from this.</summary>
        [HttpGet("me")]
        [Authorize]
        public async Task<IActionResult> Me()
        {
            var userId = User.GetUserId();
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return Unauthorized();
            return Ok(new
            {
                userId = user.Id,
                user.Name,
                user.Email,
                role = user.Role.ToLowerInvariant(),
                user.EmailConfirmed,
                user.VerificationStatus
            });
        }

        /// <summary>Always answers the same way, so it can't be used to find out which emails have accounts.</summary>
        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
        {
            var email = (request.Email ?? "").Trim().ToLowerInvariant();
            if (email.Contains('@'))
            {
                var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email);
                if (user != null) await _tokens.SendPasswordResetAsync(user);
            }
            return Ok(new { message = "If that email has an Apartey account, we've sent a link to reset the password." });
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
        {
            if (string.IsNullOrEmpty(request.Password) || request.Password.Length < 8)
                return BadRequest(new { message = "Password must be at least 8 characters." });

            var user = await _tokens.ConsumeAsync(request.Token, AccountTokenService.ResetPassword);
            if (user == null) return BadRequest(new { message = "This reset link is invalid or has expired. Request a new one." });

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
            user.EmailConfirmed = true; // they proved they can read this inbox
            await _context.SaveChangesAsync();
            return Ok(new { message = "Password updated. You can log in now." });
        }

        [HttpPost("verify-email")]
        public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailRequest request)
        {
            var user = await _tokens.ConsumeAsync(request.Token, AccountTokenService.VerifyEmail);
            if (user == null) return BadRequest(new { message = "This confirmation link is invalid or has expired." });

            user.EmailConfirmed = true;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Email confirmed. Thanks!" });
        }

        [HttpPost("resend-verification")]
        [Authorize]
        public async Task<IActionResult> ResendVerification()
        {
            var user = await _context.Users.FindAsync(User.GetUserId());
            if (user == null) return Unauthorized();
            if (user.EmailConfirmed) return Ok(new { message = "Your email is already confirmed." });
            await _tokens.SendVerificationAsync(user);
            return Ok(new { message = $"We've sent a confirmation link to {user.Email}." });
        }
    }
}
