using Microsoft.EntityFrameworkCore;
using Shortlet.Api.Helpers;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Services
{
    public class CreditService
    {
        private readonly AppDbContext _db;

        public CreditService(AppDbContext db) => _db = db;

        /// <summary>
        /// Available credit = credits granted − credit already applied to bookings that still block dates.
        /// CreditApplied is stored as a positive amount, so it is subtracted. Cancelled or expired bookings stop
        /// blocking dates, so their applied credit is released automatically.
        /// </summary>
        public async Task<decimal> GetBalanceAsync(Guid userId)
        {
            var granted = await _db.UserCredits
                .Where(c => c.UserId == userId)
                .SumAsync(c => (decimal?)c.Amount) ?? 0m;

            var locked = await _db.Bookings
                .Where(b => b.GuestId == userId)
                .BlockingDates(_db, DateTime.UtcNow)
                .SumAsync(b => (decimal?)b.CreditApplied) ?? 0m;

            return Math.Round(granted - locked, 2);
        }
    }
}
