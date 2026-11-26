using System;

namespace Shortlet.Core.Entities
{
    /// <summary>One-time token for password resets and email verification. Only a SHA-256 hash is stored.</summary>
    public class UserToken
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid UserId { get; set; }
        public string Purpose { get; set; } = string.Empty; // "reset-password" | "verify-email"
        public string TokenHash { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; }
        public DateTime? UsedAt { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
