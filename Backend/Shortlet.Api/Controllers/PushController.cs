using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shortlet.Api.Helpers;
using Shortlet.Api.Services;
using Shortlet.Core.Entities;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Controllers
{
    public class PushSubscribeRequest
    {
        public string Endpoint { get; set; } = string.Empty;
        public PushKeys Keys { get; set; } = new();
        public class PushKeys
        {
            public string P256dh { get; set; } = string.Empty;
            public string Auth { get; set; } = string.Empty;
        }
    }

    public class PushUnsubscribeRequest
    {
        public string Endpoint { get; set; } = string.Empty;
    }

    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class PushController : ControllerBase
    {
        private const int MaxDevicesPerUser = 10;
        private readonly AppDbContext _context;
        private readonly Notifier _notifier;

        public PushController(AppDbContext context, Notifier notifier)
        {
            _context = context;
            _notifier = notifier;
        }

        /// <summary>The VAPID public key the browser needs to subscribe.</summary>
        [HttpGet("public-key")]
        [AllowAnonymous]
        public IActionResult GetPublicKey() =>
            Ok(new { enabled = _notifier.PushEnabled, publicKey = _notifier.PushEnabled ? _notifier.PublicKey : null });

        [HttpPost("subscribe")]
        public async Task<IActionResult> Subscribe([FromBody] PushSubscribeRequest request)
        {
            var userId = User.GetUserId();
            if (userId == null) return Unauthorized();
            if (!_notifier.PushEnabled) return BadRequest(new { message = "Push notifications aren't set up on the server." });

            if (!Uri.TryCreate(request.Endpoint, UriKind.Absolute, out var endpoint) || endpoint.Scheme != Uri.UriSchemeHttps
                || string.IsNullOrWhiteSpace(request.Keys.P256dh) || string.IsNullOrWhiteSpace(request.Keys.Auth)
                || request.Endpoint.Length > 1000 || request.Keys.P256dh.Length > 200 || request.Keys.Auth.Length > 100)
                return BadRequest(new { message = "Invalid push subscription." });

            var existing = await _context.PushSubscriptions.FirstOrDefaultAsync(s => s.Endpoint == request.Endpoint);
            if (existing != null)
            {
                existing.UserId = userId.Value; // same device, possibly a different account now
                existing.P256dh = request.Keys.P256dh;
                existing.Auth = request.Keys.Auth;
            }
            else
            {
                // Keep the newest few devices per user.
                var old = await _context.PushSubscriptions.Where(s => s.UserId == userId.Value)
                    .OrderByDescending(s => s.CreatedAt).Skip(MaxDevicesPerUser - 1).ToListAsync();
                _context.PushSubscriptions.RemoveRange(old);
                _context.PushSubscriptions.Add(new PushSubscription
                {
                    UserId = userId.Value,
                    Endpoint = request.Endpoint,
                    P256dh = request.Keys.P256dh,
                    Auth = request.Keys.Auth,
                    UserAgent = Request.Headers.UserAgent.ToString() is { Length: > 0 } ua ? ua[..Math.Min(ua.Length, 300)] : null
                });
            }
            await _context.SaveChangesAsync();

            await _notifier.NotifyAsync(userId.Value, "Notifications are on", "You'll hear from us about bookings, payments and messages.", "/");
            return Ok(new { message = "Notifications turned on." });
        }

        [HttpPost("unsubscribe")]
        public async Task<IActionResult> Unsubscribe([FromBody] PushUnsubscribeRequest request)
        {
            var userId = User.GetUserId();
            await _context.PushSubscriptions.Where(s => s.Endpoint == request.Endpoint && s.UserId == userId).ExecuteDeleteAsync();
            return Ok(new { message = "Notifications turned off on this device." });
        }
    }
}
