using System.Net;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Shortlet.Core.Entities;
using Shortlet.Core.Interfaces;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Services
{
    /// <summary>Password-reset and email-verification links.</summary>
    public class AccountTokenService
    {
        public const string ResetPassword = "reset-password";
        public const string VerifyEmail = "verify-email";
        private static readonly TimeSpan ResetLifetime = TimeSpan.FromHours(1);
        private static readonly TimeSpan VerifyLifetime = TimeSpan.FromHours(48);
        private static readonly TimeSpan ResendCooldown = TimeSpan.FromMinutes(1);

        private readonly AppDbContext _db;
        private readonly IEmailQueue _email;
        private readonly IConfiguration _config;

        public AccountTokenService(AppDbContext db, IEmailQueue email, IConfiguration config)
        {
            _db = db;
            _email = email;
            _config = config;
        }

        private string FrontendUrl(string path) =>
            (_config["Frontend:BaseUrl"] ?? "https://aparteyng.vercel.app").TrimEnd('/') + path;

        private static string Hash(string token) =>
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

        /// <summary>Creates a token (invalidating older unused ones for the same purpose). Null if one was sent under a minute ago.</summary>
        private async Task<string?> IssueAsync(Guid userId, string purpose, TimeSpan lifetime)
        {
            var now = DateTime.UtcNow;
            var recent = await _db.UserTokens.AnyAsync(t => t.UserId == userId && t.Purpose == purpose && t.CreatedAt > now - ResendCooldown);
            if (recent) return null;

            await _db.UserTokens.Where(t => t.UserId == userId && t.Purpose == purpose && t.UsedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.UsedAt, now));

            var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
            _db.UserTokens.Add(new UserToken { UserId = userId, Purpose = purpose, TokenHash = Hash(token), ExpiresAt = now + lifetime });
            await _db.SaveChangesAsync();
            return token;
        }

        /// <summary>Marks a token used and returns its user, or null if it's unknown, used or expired.</summary>
        public async Task<User?> ConsumeAsync(string token, string purpose)
        {
            if (string.IsNullOrWhiteSpace(token) || token.Length > 100) return null;
            var hash = Hash(token.Trim());
            var row = await _db.UserTokens.FirstOrDefaultAsync(t => t.TokenHash == hash && t.Purpose == purpose);
            if (row == null || row.UsedAt != null || row.ExpiresAt < DateTime.UtcNow) return null;

            row.UsedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return await _db.Users.FindAsync(row.UserId);
        }

        public async Task SendVerificationAsync(User user)
        {
            if (user.EmailConfirmed) return;
            var token = await IssueAsync(user.Id, VerifyEmail, VerifyLifetime);
            if (token == null) return;
            var link = FrontendUrl($"/verify-email?token={token}");
            await _email.QueueEmailAsync(new EmailMessagePayload
            {
                ToEmail = user.Email,
                Subject = "Confirm your email for Apartey",
                Body = $"<p>Hi {WebUtility.HtmlEncode(user.Name)},</p><p>Please confirm this is your email address:</p>" +
                       $"<p><a href=\"{link}\" style=\"display:inline-block;background:#16160F;color:#F2F1EA;padding:12px 18px;border-radius:10px;text-decoration:none\">Confirm my email</a></p>" +
                       $"<p style=\"color:#5A5949;font-size:13px\">This link works for 48 hours. If you didn’t create an Apartey account, ignore this email.</p>"
            });
        }

        public async Task SendPasswordResetAsync(User user)
        {
            var token = await IssueAsync(user.Id, ResetPassword, ResetLifetime);
            if (token == null) return;
            var link = FrontendUrl($"/reset-password?token={token}");
            await _email.QueueEmailAsync(new EmailMessagePayload
            {
                ToEmail = user.Email,
                Subject = "Reset your Apartey password",
                Body = $"<p>Hi {WebUtility.HtmlEncode(user.Name)},</p><p>Someone (hopefully you) asked to reset your Apartey password.</p>" +
                       $"<p><a href=\"{link}\" style=\"display:inline-block;background:#16160F;color:#F2F1EA;padding:12px 18px;border-radius:10px;text-decoration:none\">Choose a new password</a></p>" +
                       $"<p style=\"color:#5A5949;font-size:13px\">This link works for 1 hour and can be used once. If you didn’t ask for this, you can ignore this email; your password won’t change.</p>"
            });
        }
    }
}
