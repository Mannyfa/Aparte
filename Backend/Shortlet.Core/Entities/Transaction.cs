using System;

namespace Shortlet.Core.Entities
{
    public class Transaction
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid WalletId { get; set; }
        public Wallet Wallet { get; set; } = null!;

        public decimal Amount { get; set; }
        public string Type { get; set; } = string.Empty; // "Credit", "Debit", or "Withdrawal"
        public string Description { get; set; } = string.Empty;
        public string Reference { get; set; } = string.Empty; // Paystack ref, booking id, or payout ref

        /// <summary>
        /// "Completed" for ledger entries that are final. Withdrawals start "Pending" until Paystack
        /// confirms the bank transfer, then become "Completed" or "Failed" (money returned to the wallet).
        /// </summary>
        public string Status { get; set; } = "Completed";

        public DateTime Date { get; set; } = DateTime.UtcNow;
    }
}
