using System;
using System.Collections.Generic;

namespace Shortlet.Core.Entities
{
    public class Wallet
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        
        // Links to the Host (User)
        public Guid HostId { get; set; }
        public User Host { get; set; }

        public decimal Balance { get; set; } = 0; // Money ready to withdraw
        public decimal PendingClearance { get; set; } = 0; // Money held until check-in (optional advanced feature)
        
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation property for Entity Framework
        public ICollection<Transaction> Transactions { get; set; }
    }
}