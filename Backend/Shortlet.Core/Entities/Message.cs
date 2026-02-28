// Backend/Shortlet.Core/Entities/Message.cs
using System;

namespace Shortlet.Core.Entities
{
    public class Message
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        
        public Guid SenderId { get; set; }
        public User Sender { get; set; }

        public Guid ReceiverId { get; set; }
        public User Receiver { get; set; }

        public string Content { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public bool IsRead { get; set; } = false;
    }
}