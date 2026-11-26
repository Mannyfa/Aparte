using Microsoft.EntityFrameworkCore;
using Shortlet.Api.Helpers;
using Shortlet.Core.Entities;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Services
{
    public record NightPrice(DateTime Date, decimal Price, string Rule);

    public record PromoResult(string Code, bool Valid, decimal Discount, string? Message, Guid? PromoId);

    public class StayPrice
    {
        public List<NightPrice> Nightly { get; init; } = new();
        public int Nights => Nightly.Count;
        public decimal RoomAmount { get; init; }
        public decimal PlatformFee { get; init; }
        public List<PropertyAddOn> AddOns { get; init; } = new();
        public decimal AddOnsTotal { get; init; }
        public decimal CautionFee { get; init; }
        public PromoResult? Promo { get; init; }
        public decimal PromoDiscount { get; init; }
        public decimal CreditBalance { get; init; }
        public decimal CreditApplied { get; init; }
        public decimal Total { get; init; }
    }

    /// <summary>Single place that prices a stay, used by both the quote and the booking so they never disagree.</summary>
    public class BookingPricer
    {
        private readonly AppDbContext _db;
        private readonly CreditService _credit;

        public BookingPricer(AppDbContext db, CreditService credit)
        {
            _db = db;
            _credit = credit;
        }

        public async Task<StayPrice> PriceAsync(Property property, DateTime checkIn, DateTime checkOut,
            IEnumerable<Guid>? addOnIds, string? promoCode, bool useCredit, Guid guestId, DateTime utcNow)
        {
            var rules = await _db.PriceRules
                .Where(r => r.PropertyId == property.Id && r.StartDate < checkOut && r.EndDate >= checkIn)
                .AsNoTracking().ToListAsync();

            var nightly = new List<NightPrice>();
            for (var d = checkIn; d < checkOut; d = d.AddDays(1))
            {
                var rule = rules.FirstOrDefault(r => r.StartDate <= d && r.EndDate >= d);
                if (rule != null) nightly.Add(new NightPrice(d, rule.NightlyPrice, "season"));
                else if (property.WeekendPricePerNight.HasValue && (d.DayOfWeek == DayOfWeek.Friday || d.DayOfWeek == DayOfWeek.Saturday))
                    nightly.Add(new NightPrice(d, property.WeekendPricePerNight.Value, "weekend"));
                else nightly.Add(new NightPrice(d, property.PricePerNight, "base"));
            }

            var room = nightly.Sum(n => n.Price);
            var fee = Math.Round(room * BookingRules.PlatformFeeRate, 2);

            var addOns = new List<PropertyAddOn>();
            var ids = addOnIds?.Distinct().ToList();
            if (ids is { Count: > 0 })
                addOns = await _db.PropertyAddOns.Where(a => ids.Contains(a.Id) && a.PropertyId == property.Id).ToListAsync();
            var addOnsTotal = addOns.Sum(a => a.Price);
            var caution = property.CautionFee;

            PromoResult? promo = null;
            decimal discount = 0;
            var code = promoCode?.Trim().ToUpperInvariant();
            if (!string.IsNullOrEmpty(code))
            {
                var p = await _db.PromoCodes.FirstOrDefaultAsync(x => x.Code == code);
                if (p == null || !p.IsActive)
                    promo = new PromoResult(code, false, 0, "This promo code is not valid.", null);
                else if (p.ExpiresAt != null && p.ExpiresAt <= utcNow)
                    promo = new PromoResult(code, false, 0, "This promo code has expired.", null);
                else
                {
                    var used = p.UsageLimit == null ? 0 : await _db.Bookings
                        .Where(b => b.PromoCodeId == p.Id).BlockingDates(_db, utcNow).CountAsync();
                    if (p.UsageLimit != null && used >= p.UsageLimit)
                        promo = new PromoResult(code, false, 0, "This promo code has reached its usage limit.", null);
                    else
                    {
                        var raw = p.DiscountType == "percent" ? Math.Round(room * p.DiscountValue / 100m, 2) : p.DiscountValue;
                        discount = Math.Max(0, Math.Min(raw, fee));
                        promo = new PromoResult(code, true, discount, null, p.Id);
                    }
                }
            }

            decimal balance = 0, applied = 0;
            if (useCredit)
            {
                balance = await _credit.GetBalanceAsync(guestId);
                var cap = Math.Round((room + fee + addOnsTotal + caution) * 0.5m, 2);
                applied = Math.Round(Math.Max(0, Math.Min(balance, Math.Min(fee - discount, cap))), 2);
            }

            return new StayPrice
            {
                Nightly = nightly, RoomAmount = room, PlatformFee = fee, AddOns = addOns, AddOnsTotal = addOnsTotal,
                CautionFee = caution, Promo = promo, PromoDiscount = discount, CreditBalance = balance, CreditApplied = applied,
                Total = room + fee - discount - applied + addOnsTotal + caution
            };
        }
    }
}
