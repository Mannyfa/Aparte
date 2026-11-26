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

        /// <summary>Promo code applied at checkout, if any.</summary>
        public Guid? PromoCodeId { get; set; }
        /// <summary>Promo discount taken off the platform fee.</summary>
        public decimal PromoDiscount { get; set; } = 0;
        /// <summary>Referral credit applied at checkout, taken off the platform fee.</summary>
        public decimal CreditApplied { get; set; } = 0;
        /// <summary>Sum of nightly prices for the stay. 0 means a legacy booking made before this was stored.</summary>
        public decimal RoomAmount { get; set; } = 0;

        public string? CheckInCode { get; set; }
        
        // pending, split_pending, paid, confirmed, completed, rejected, cancelled, expired, failed
        public string Status { get; set; } = "pending";
        public string PaymentReference { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // --- ESCROW & CAUTION FEE TRACKING ---
        public decimal CautionFeeAmount { get; set; } = 0;
        // None → Pending (unpaid) → Held (in escrow) → Refunded / Claimed / PartlyClaimed
        public string CautionFeeStatus { get; set; } = "None";
        /// <summary>Amount the host kept for damage (0 when the whole deposit went back to the guest).</summary>
        public decimal CautionClaimAmount { get; set; } = 0;
        public string? CautionClaimReason { get; set; }
        public DateTime? CautionResolvedAt { get; set; }


        public ICollection<BookingAddOn> PurchasedAddOns { get; set; } = new List<BookingAddOn>();
    }
}