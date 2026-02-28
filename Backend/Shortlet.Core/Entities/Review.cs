// Backend/Shortlet.Core/Entities/Review.cs
using System;

namespace Shortlet.Core.Entities
{
    public class Review
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        
        // The property being reviewed
        public Guid PropertyId { get; set; }
        public Property Property { get; set; }

        // The guest leaving the review
        public Guid GuestId { get; set; }
        public User Guest { get; set; }

        public int Rating { get; set; } // 1 to 5 Stars
        public string Comment { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}