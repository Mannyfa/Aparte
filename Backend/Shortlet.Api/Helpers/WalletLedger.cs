using Microsoft.EntityFrameworkCore;
using Shortlet.Core.Entities;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Helpers
{
    public static class WalletLedger
    {
        /// <summary>
        /// Takes a transaction-scoped lock on the host's wallet (creating it if needed) so concurrent
        /// credits/withdrawals can't overwrite each other's balance. Must be called inside a DB transaction.
        /// </summary>
        public static async Task<Wallet> LockWalletAsync(AppDbContext context, Guid hostId)
        {
            var lockKey = "wallet:" + hostId;
            await context.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtext({lockKey}))");

            var wallet = await context.Wallets.FirstOrDefaultAsync(w => w.HostId == hostId);
            if (wallet == null)
            {
                wallet = new Wallet { HostId = hostId, Balance = 0 };
                context.Wallets.Add(wallet);
            }
            return wallet;
        }

        /// <summary>Locks a booking row until the surrounding transaction ends.</summary>
        public static Task LockBookingAsync(AppDbContext context, Guid bookingId) =>
            context.Database.ExecuteSqlInterpolatedAsync($"SELECT 1 FROM \"Bookings\" WHERE \"Id\" = {bookingId} FOR UPDATE");

        /// <summary>Locks a split share row until the surrounding transaction ends.</summary>
        public static Task LockShareAsync(AppDbContext context, Guid shareId) =>
            context.Database.ExecuteSqlInterpolatedAsync($"SELECT 1 FROM \"SplitShares\" WHERE \"Id\" = {shareId} FOR UPDATE");
    }
}
