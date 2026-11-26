using Shortlet.Core.Entities;

namespace Shortlet.Api.Helpers
{
    /// <summary>Single source of truth for splitting a booking's total into room, discounts and host earnings.</summary>
    public static class BookingMoney
    {
        public static decimal Discount(Booking b) => b.PromoDiscount + b.CreditApplied;

        /// <summary>Room x 1.05 before discounts.</summary>
        public static decimal RoomWithFee(Booking b, decimal addOnsTotal) =>
            b.TotalPrice + Discount(b) - b.CautionFeeAmount - addOnsTotal;

        public static decimal RoomAmount(Booking b, decimal addOnsTotal) =>
            b.RoomAmount > 0 ? b.RoomAmount : Math.Round(RoomWithFee(b, addOnsTotal) / (1 + BookingRules.PlatformFeeRate), 2);

        /// <summary>The host keeps room + 100% of add-ons; discounts never touch it.</summary>
        public static decimal HostEarnings(Booking b, decimal addOnsTotal) =>
            Math.Round(RoomWithFee(b, addOnsTotal) / (1 + BookingRules.PlatformFeeRate) + addOnsTotal, 2);
    }
}
