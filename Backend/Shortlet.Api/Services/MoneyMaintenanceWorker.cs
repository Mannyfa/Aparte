using Microsoft.EntityFrameworkCore;
using Shortlet.Core.Interfaces;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Services
{
    /// <summary>
    /// Runs every few minutes and moves money along when nobody else will:
    ///  1. expires split groups that weren't fully paid in time and refunds the friends who did pay;
    ///  2. cancels and refunds paid bookings the host never accepted before check-in;
    ///  3. marks confirmed stays as completed after check-out;
    ///  4. returns caution fees to guests when the host's claim window closes;
    ///  5. resumes caution releases whose refund didn't go through;
    ///  6. retries failed refunds (up to <see cref="BookingFinanceService.MaxRefundAttempts"/> times);
    ///  7. asks Paystack about withdrawals still pending after 10 minutes.
    /// Each step is idempotent, so a crash or overlap can't move money twice.
    /// </summary>
    public class MoneyMaintenanceWorker : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IConfiguration _config;
        private readonly ILogger<MoneyMaintenanceWorker> _logger;

        public MoneyMaintenanceWorker(IServiceScopeFactory scopeFactory, IConfiguration config, ILogger<MoneyMaintenanceWorker> logger)
        {
            _scopeFactory = scopeFactory;
            _config = config;
            _logger = logger;
        }

        private TimeSpan Interval => TimeSpan.FromMinutes(int.TryParse(_config["Escrow:MaintenanceIntervalMinutes"], out var m) && m > 0 ? m : 10);

        /// <summary>Hours after the (UTC midnight) check-in date by which a host must accept a paid booking. 12h ≈ 1pm in Lagos.</summary>
        private TimeSpan HostResponseDeadline => TimeSpan.FromHours(int.TryParse(_config["Escrow:HostResponseHoursAfterCheckIn"], out var h) && h >= 0 ? h : 12);

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // Let the app finish starting before the first run.
            try { await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken); } catch (OperationCanceledException) { return; }

            while (!stoppingToken.IsCancellationRequested)
            {
                await RunOnceAsync(stoppingToken);
                try { await Task.Delay(Interval, stoppingToken); } catch (OperationCanceledException) { return; }
            }
        }

        public async Task RunOnceAsync(CancellationToken ct = default)
        {
            var steps = new (string Name, Func<IServiceProvider, Task> Run)[]
            {
                ("expire split groups", ExpireSplitGroupsAsync),
                ("cancel unanswered bookings", CancelUnansweredBookingsAsync),
                ("complete finished stays", CompleteFinishedStaysAsync),
                ("auto-release caution fees", AutoReleaseCautionAsync),
                ("resume caution releases", ResumeCautionReleasesAsync),
                ("retry failed refunds", RetryFailedRefundsAsync),
                ("reconcile pending withdrawals", ReconcileWithdrawalsAsync),
            };

            foreach (var (name, run) in steps)
            {
                if (ct.IsCancellationRequested) return;
                try
                {
                    using var scope = _scopeFactory.CreateScope(); // fresh DbContext per step
                    await run(scope.ServiceProvider);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Money maintenance step '{Step}' failed; it will run again next cycle.", name);
                }
            }
        }

        private static async Task ExpireSplitGroupsAsync(IServiceProvider sp)
        {
            var db = sp.GetRequiredService<AppDbContext>();
            var finance = sp.GetRequiredService<BookingFinanceService>();
            var now = DateTime.UtcNow;

            var bookingIds = await db.SplitGroups
                .Where(g => g.Status == "Pending" && g.ExpiresAt < now && g.Booking.Status == "split_pending")
                .Select(g => g.BookingId).Take(50).ToListAsync();

            foreach (var id in bookingIds)
                await finance.CancelAndRefundAsync(id, "expired", "Group payment window expired",
                    "Your group booking expired because not everyone paid their share within 24 hours.");
        }

        private async Task CancelUnansweredBookingsAsync(IServiceProvider sp)
        {
            var db = sp.GetRequiredService<AppDbContext>();
            var finance = sp.GetRequiredService<BookingFinanceService>();
            var cutoff = DateTime.UtcNow - HostResponseDeadline;

            var bookingIds = await db.Bookings
                .Where(b => b.Status == "paid" && b.CheckIn <= cutoff)
                .Select(b => b.Id).Take(50).ToListAsync();

            foreach (var id in bookingIds)
                await finance.CancelAndRefundAsync(id, "cancelled", "Host didn't respond before check-in",
                    "Your host didn't confirm the booking before check-in, so we've cancelled it.");
        }

        private static async Task CompleteFinishedStaysAsync(IServiceProvider sp)
        {
            var db = sp.GetRequiredService<AppDbContext>();
            var now = DateTime.UtcNow;
            await db.Bookings
                .Where(b => b.Status == "confirmed" && b.CheckOut <= now)
                .ExecuteUpdateAsync(s => s.SetProperty(b => b.Status, "completed"));
        }

        private static async Task AutoReleaseCautionAsync(IServiceProvider sp)
        {
            var db = sp.GetRequiredService<AppDbContext>();
            var finance = sp.GetRequiredService<BookingFinanceService>();
            var closedBefore = DateTime.UtcNow - finance.CautionClaimWindow;

            var bookingIds = await db.Bookings
                .Where(b => b.CautionFeeStatus == "Held" && (b.Status == "completed" || b.Status == "confirmed") && b.CheckOut <= closedBefore)
                .Select(b => b.Id).Take(50).ToListAsync();

            foreach (var id in bookingIds)
                await finance.ResolveCautionAsync(id, 0, null);
        }

        private static async Task ResumeCautionReleasesAsync(IServiceProvider sp)
        {
            var db = sp.GetRequiredService<AppDbContext>();
            var finance = sp.GetRequiredService<BookingFinanceService>();
            var stale = DateTime.UtcNow.AddMinutes(-5);

            var bookingIds = await db.Bookings
                .Where(b => b.CautionFeeStatus == "Releasing" && (b.CautionResolvedAt == null || b.CautionResolvedAt < stale))
                .Select(b => b.Id).Take(50).ToListAsync();

            foreach (var id in bookingIds)
                await finance.ResolveCautionAsync(id, 0, null); // resumes with the saved claim amount
        }

        private async Task RetryFailedRefundsAsync(IServiceProvider sp)
        {
            var db = sp.GetRequiredService<AppDbContext>();
            var finance = sp.GetRequiredService<BookingFinanceService>();
            var retryAfter = DateTime.UtcNow.AddMinutes(-15);

            var failed = await db.Refunds
                .Where(r => (r.Status == "Failed" || r.Status == "Requesting") && r.Attempts < BookingFinanceService.MaxRefundAttempts
                            && (r.UpdatedAt ?? r.CreatedAt) < retryAfter)
                .Take(50).ToListAsync();

            foreach (var r in failed)
            {
                var ok = await finance.RefundOnceAsync(r.BookingId, r.TransactionReference, r.Amount,
                    partial: r.Purpose == BookingFinanceService.PurposeCaution, r.Purpose, "Retrying refund");
                if (!ok && r.Attempts + 1 >= BookingFinanceService.MaxRefundAttempts)
                    _logger.LogCritical("Refund of ₦{Amount:N2} on {Reference} has failed {Max} times. Refund it manually in the Paystack dashboard.",
                        r.Amount, r.TransactionReference, BookingFinanceService.MaxRefundAttempts);
            }
        }

        private static async Task ReconcileWithdrawalsAsync(IServiceProvider sp)
        {
            var db = sp.GetRequiredService<AppDbContext>();
            var finance = sp.GetRequiredService<BookingFinanceService>();
            var paystack = sp.GetRequiredService<IPaystackService>();
            var olderThan = DateTime.UtcNow.AddMinutes(-10);

            var references = await db.Transactions
                .Where(t => t.Type == "Withdrawal" && t.Status == "Pending" && t.Date < olderThan)
                .Select(t => t.Reference).Take(50).ToListAsync();

            foreach (var reference in references)
            {
                var result = await paystack.VerifyTransferAsync(reference);
                if (result.Found)
                    await finance.FinalizePayoutAsync(reference, result.Status);
                else if (result.Message.Contains("not found", StringComparison.OrdinalIgnoreCase))
                    await finance.FinalizePayoutAsync(reference, "failed"); // Paystack never received it: return the money
            }
        }
    }
}
