using System;

namespace Shortlet.Core.Entities
{
    public class Booking
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid PropertyId { get; set; }
        public Property Property { get; set; } = null!;
        
        public Guid GuestId { get; set; }
        public User Guest { get; set; } = null!;
        
        public DateTime CheckIn { get; set; }
        public DateTime CheckOut { get; set; }
        
        public decimal TotalPrice { get; set; }
        public decimal ServiceFee { get; set; }
        
        // pending, paid, cancelled, completed
        public string Status { get; set; } = "pending"; 
        public string PaymentReference { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}