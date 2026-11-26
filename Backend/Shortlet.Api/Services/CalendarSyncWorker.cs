using Microsoft.EntityFrameworkCore;
using Shortlet.Api.Controllers;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Services
{
    /// <summary>Re-imports every connected external calendar (Airbnb, Booking.com…) on a schedule.</summary>
    public class CalendarSyncWorker : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IConfiguration _config;
        private readonly ILogger<CalendarSyncWorker> _logger;

        public CalendarSyncWorker(IServiceScopeFactory scopeFactory, IConfiguration config, ILogger<CalendarSyncWorker> logger)
        {
            _scopeFactory = scopeFactory;
            _config = config;
            _logger = logger;
        }

        private TimeSpan Interval => TimeSpan.FromMinutes(int.TryParse(_config["Calendar:SyncIntervalMinutes"], out var m) && m >= 5 ? m : 30);

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            try { await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken); } catch (OperationCanceledException) { return; }

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var sync = scope.ServiceProvider.GetRequiredService<CalendarSyncService>();

                    var dueBefore = DateTime.UtcNow - Interval + TimeSpan.FromMinutes(1);
                    var feeds = await db.CalendarFeeds
                        .Where(f => f.LastSyncedAt == null || f.LastSyncedAt < dueBefore)
                        .OrderBy(f => f.LastSyncedAt)
                        .Take(200)
                        .ToListAsync(stoppingToken);

                    var changed = 0;
                    foreach (var feed in feeds)
                    {
                        if (stoppingToken.IsCancellationRequested) break;
                        var (ok, _) = await sync.SyncFeedAsync(feed, stoppingToken);
                        if (ok) changed++;
                        await Task.Delay(TimeSpan.FromMilliseconds(500), stoppingToken); // be polite to Airbnb & co.
                    }
                    if (changed > 0)
                    {
                        PropertiesController.InvalidatePublicCache();
                        _logger.LogInformation("Synced {Count} external calendars.", changed);
                    }
                }
                catch (OperationCanceledException) { return; }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Calendar sync run failed; retrying next cycle.");
                }

                try { await Task.Delay(Interval, stoppingToken); } catch (OperationCanceledException) { return; }
            }
        }
    }
}
