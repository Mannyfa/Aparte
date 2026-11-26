using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Shortlet.Api.Hubs;
using Shortlet.Infrastructure.Data;
using WebPush;
using DbPushSubscription = Shortlet.Core.Entities.PushSubscription;

namespace Shortlet.Api.Services
{
    /// <summary>
    /// Sends a notification to a user everywhere they can get it:
    ///  - live toast in any open Apartey tab (SignalR);
    ///  - web push to every device that turned notifications on (works with the app closed;
    ///    on iPhone only when Apartey is added to the home screen, iOS 16.4+).
    /// Failures are logged, never thrown: a notification must not break the action that triggered it.
    /// </summary>
    public class Notifier
    {
        private readonly AppDbContext _db;
        private readonly IHubContext<ChatHub> _hub;
        private readonly IConfiguration _config;
        private readonly ILogger<Notifier> _logger;
        private static readonly WebPushClient PushClient = new();

        public Notifier(AppDbContext db, IHubContext<ChatHub> hub, IConfiguration config, ILogger<Notifier> logger)
        {
            _db = db;
            _hub = hub;
            _config = config;
            _logger = logger;
        }

        public string? PublicKey => _config["Push:PublicKey"];
        public bool PushEnabled => !string.IsNullOrEmpty(_config["Push:PublicKey"]) && !string.IsNullOrEmpty(_config["Push:PrivateKey"]);

        /// <param name="url">Page to open when the notification is tapped (e.g. "/dashboard").</param>
        /// <param name="live">False to skip the in-app toast (e.g. chat messages, which have their own live event).</param>
        public async Task NotifyAsync(Guid userId, string title, string message, string url = "/", string kind = "ReceiveNotification", bool live = true)
        {
            if (live) try
            {
                await _hub.Clients.Group(userId.ToString()).SendAsync(kind, new { title, message, url });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Live notification to {UserId} failed", userId);
            }

            if (!PushEnabled) return;

            List<DbPushSubscription> subscriptions;
            try
            {
                subscriptions = await _db.PushSubscriptions.Where(s => s.UserId == userId).ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not load push subscriptions for {UserId}", userId);
                return;
            }
            if (subscriptions.Count == 0) return;

            var vapid = new VapidDetails(_config["Push:Subject"] ?? "mailto:support@apartey.ng", _config["Push:PublicKey"], _config["Push:PrivateKey"]);
            var payload = JsonSerializer.Serialize(new { title, body = message, url, tag = kind });
            var expired = new List<DbPushSubscription>();

            foreach (var s in subscriptions)
            {
                try
                {
                    await PushClient.SendNotificationAsync(new WebPush.PushSubscription(s.Endpoint, s.P256dh, s.Auth), payload, vapid);
                }
                catch (WebPushException ex) when (ex.StatusCode is HttpStatusCode.Gone or HttpStatusCode.NotFound)
                {
                    expired.Add(s); // the user revoked permission or the browser dropped the subscription
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Push to {UserId} failed", userId);
                }
            }

            if (expired.Count > 0)
            {
                _db.PushSubscriptions.RemoveRange(expired);
                await _db.SaveChangesAsync();
            }
        }
    }
}
