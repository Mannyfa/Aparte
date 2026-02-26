// Backend/Shortlet.Core/Entities/Conversation.cs
using System;

namespace Shortlet.Core.Entities
{
    public class Conversation
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid PropertyId { get; set; }
        public Guid GuestId { get; set; }
        public Guid HostId { get; set; }
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}