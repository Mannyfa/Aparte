using System;

namespace Shortlet.Core.Entities
{
    /// <summary>A listing a guest saved to their wishlist. Unique per (UserId, PropertyId).</summary>
    public class SavedProperty
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid UserId { get; set; }
        public Guid PropertyId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
