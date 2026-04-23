using System;
using System.Collections.Generic;

namespace Shortlet.Core.Entities
{
    public class SplitGroup
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        
        
        public Guid BookingId { get; set; }
        public Booking Booking { get; set; }
        
       
        public decimal TotalAmount { get; set; }
        public int TotalShares { get; set; }
        public int PaidShares { get; set; }
        
       
        public string Status { get; set; } = "Pending"; 
        
        
        public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddHours(24);
        
        
        public ICollection<SplitShare> Shares { get; set; } = new List<SplitShare>();
    }
}