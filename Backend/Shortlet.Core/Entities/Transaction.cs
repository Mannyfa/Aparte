using System;

namespace Shortlet.Core.Entities
{
    public class Transaction
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        
        public Guid WalletId { get; set; }
        public Wallet Wallet { get; set; }

        public decimal Amount { get; set; }
        public string Type { get; set; } // "Credit", "Debit", or "Withdrawal"
        public string Description { get; set; }
        public string Reference { get; set; } // Paystack Ref or Booking ID
        public DateTime Date { get; set; } = DateTime.UtcNow;
    }
}