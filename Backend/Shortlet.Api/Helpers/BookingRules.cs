using System.Security.Cryptography;
using Shortlet.Core.Entities;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Helpers
{
    public static class BookingRules
    {
        /// <summary>How long an unpaid solo checkout holds its dates.</summary>
        public static readonly TimeSpan PendingHold = TimeSpan.FromMinutes(30);

        public const decimal PlatformFeeRate = 0.05m;
        public const int MaxSplitWays = 10;
        public const int MaxNights = 90;

        /// <summary>
        /// Bookings that currently occupy their dates: paid/confirmed/completed ones, unpaid solo
        /// checkouts younger than <see cref="PendingHold"/>, and split groups that haven't expired.
        /// Abandoned checkouts therefore release their dates automatically.
        /// </summary>
        public static IQueryable<Booking> BlockingDates(this IQueryable<Booking> bookings, AppDbContext context, DateTime utcNow)
        {
            var pendingCutoff = utcNow - PendingHold;
            return bookings.Where(b =>
                b.Status == "paid" || b.Status == "confirmed" || b.Status == "completed" ||
                (b.Status == "pending" && b.CreatedAt > pendingCutoff) ||
                (b.Status == "split_pending" && context.SplitGroups.Any(sg => sg.BookingId == b.Id && sg.ExpiresAt > utcNow)));
        }

        /// <summary>Dates are stored as UTC midnight so a calendar day never shifts with the user's time zone.</summary>
        public static DateTime ToUtcDate(DateTime value) => DateTime.SpecifyKind(value.Date, DateTimeKind.Utc);

        public static string NewCheckInCode() => RandomNumberGenerator.GetInt32(100000, 1000000).ToString();

        /// <summary>Paystack references allow only letters, digits, '-', '.', '='.</summary>
        public static string NewSplitReference(Guid shareId) => $"SPLIT-{shareId:N}-{Guid.NewGuid():N}"[..48];

        /// <summary>Extracts the share id from a reference created by <see cref="NewSplitReference"/>.</summary>
        public static bool TryParseSplitReference(string reference, out Guid shareId)
        {
            shareId = Guid.Empty;
            if (!reference.StartsWith("SPLIT-", StringComparison.Ordinal)) return false;
            var parts = reference.Split('-');
            return parts.Length >= 2 && Guid.TryParseExact(parts[1], "N", out shareId);
        }
    }
}
