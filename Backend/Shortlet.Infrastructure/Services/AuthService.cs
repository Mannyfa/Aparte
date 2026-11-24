// Backend/Shortlet.Infrastructure/Services/AuthService.cs
using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using Shortlet.Core.DTOs;
using Shortlet.Core.Entities;
using Shortlet.Core.Interfaces;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Infrastructure.Services
{
    public class AuthService : IAuthService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;

        public AuthService(AppDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        /// <summary>
        /// Only "guest" and "host" can be chosen at sign-up. Admins are created directly in the database.
        /// Stored roles are always lower-case.
        /// </summary>
        public static string NormaliseSignupRole(string? requested) =>
            string.Equals(requested?.Trim(), "host", StringComparison.OrdinalIgnoreCase) ? "host" : "guest";

        public async Task<AuthResponseDto> RegisterAsync(RegisterDto request)
        {
            var email = (request.Email ?? string.Empty).Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(request.Name)) throw new ArgumentException("Name is required.");
            if (string.IsNullOrEmpty(email) || !email.Contains('@')) throw new ArgumentException("A valid email is required.");
            if (string.IsNullOrEmpty(request.Password) || request.Password.Length < 8)
                throw new ArgumentException("Password must be at least 8 characters.");

            if (await _context.Users.AnyAsync(u => u.Email.ToLower() == email))
                throw new ArgumentException("Email is already registered.");

            var user = new User
            {
                Name = request.Name.Trim(),
                Email = email,
                Phone = request.Phone?.Trim() ?? string.Empty,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                Role = NormaliseSignupRole(request.Role)
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return BuildResponse(user);
        }

        public async Task<AuthResponseDto> LoginAsync(LoginDto request)
        {
            var email = (request.Email ?? string.Empty).Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email)
                ?? throw new UnauthorizedAccessException("Invalid email or password.");

            if (string.IsNullOrEmpty(request.Password) || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
                throw new UnauthorizedAccessException("Invalid email or password.");

            return BuildResponse(user);
        }

        private AuthResponseDto BuildResponse(User user) => new AuthResponseDto
        {
            Token = GenerateJwtToken(user),
            UserId = user.Id,
            Name = user.Name,
            Role = user.Role.ToLowerInvariant()
        };

        private string GenerateJwtToken(User user)
        {
            var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim(ClaimTypes.Role, user.Role.ToLowerInvariant()),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"],
                audience: _config["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddDays(7),
                signingCredentials: credentials);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
