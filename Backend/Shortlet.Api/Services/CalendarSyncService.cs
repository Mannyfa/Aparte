using System.Globalization;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Shortlet.Api.Helpers;
using Shortlet.Core.Entities;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Services
{
    /// <summary>
    /// Two-way calendar sync with Airbnb, Booking.com, VRBO and anything else that speaks iCal (.ics):
    ///  - Export: each property has a secret URL listing every unavailable night on Apartey.
    ///  - Import: hosts paste the other site's export URL; its events become blocked dates here.
    /// </summary>
    public class CalendarSyncService
    {
        public const string HttpClientName = "ical";
        private const int MaxBytes = 2 * 1024 * 1024;

        private readonly AppDbContext _db;
        private readonly IHttpClientFactory _http;
        private readonly ILogger<CalendarSyncService> _logger;

        public CalendarSyncService(AppDbContext db, IHttpClientFactory http, ILogger<CalendarSyncService> logger)
        {
            _db = db;
            _http = http;
            _logger = logger;
        }

        public static string NewToken() => Convert.ToHexString(RandomNumberGenerator.GetBytes(20)).ToLowerInvariant();

        // ------------------------------------------------------------------
        // Export
        // ------------------------------------------------------------------

        /// <summary>Builds the .ics file other sites import. Imported events are left out so calendars don't echo each other.</summary>
        public async Task<string> BuildExportAsync(Property property)
        {
            var now = DateTime.UtcNow;
            var from = now.Date.AddDays(-30);

            var bookings = await _db.Bookings
                .Where(b => b.PropertyId == property.Id && b.CheckOut > from)
                .BlockingDates(_db, now)
                .Select(b => new { b.Id, b.CheckIn, b.CheckOut })
                .ToListAsync();
            var blocks = await _db.PropertyCalendars
                .Where(c => c.PropertyId == property.Id && c.BookingId == null && c.Source == "host" && c.EndDate > from)
                .Select(c => new { c.Id, c.StartDate, c.EndDate })
                .ToListAsync();

            var sb = new StringBuilder();
            void Line(string s) => sb.Append(s).Append("\r\n");
            Line("BEGIN:VCALENDAR");
            Line("VERSION:2.0");
            Line("PRODID:-//Apartey//Calendar export//EN");
            Line("CALSCALE:GREGORIAN");
            Line("METHOD:PUBLISH");
            Line($"X-WR-CALNAME:{Escape("Apartey – " + property.Title)}");
            var stamp = now.ToString("yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture);
            foreach (var b in bookings) AddEvent(b.Id, b.CheckIn, b.CheckOut, "Reserved (Apartey)");
            foreach (var c in blocks) AddEvent(c.Id, c.StartDate, c.EndDate, "Not available (Apartey)");
            Line("END:VCALENDAR");
            return sb.ToString();

            void AddEvent(Guid id, DateTime start, DateTime end, string summary)
            {
                Line("BEGIN:VEVENT");
                Line($"UID:{id}@apartey");
                Line($"DTSTAMP:{stamp}");
                Line($"DTSTART;VALUE=DATE:{start:yyyyMMdd}");
                Line($"DTEND;VALUE=DATE:{end:yyyyMMdd}");
                Line($"SUMMARY:{Escape(summary)}");
                Line("END:VEVENT");
            }
        }

        private static string Escape(string s) => s.Replace("\\", "\\\\").Replace(";", "\\;").Replace(",", "\\,").Replace("\n", "\\n");

        // ------------------------------------------------------------------
        // Import
        // ------------------------------------------------------------------

        public record ImportedEvent(string Uid, DateTime Start, DateTime End, string? Summary);

        /// <summary>Validates a feed URL before saving it: https only, no credentials, standard port.</summary>
        public static string? ValidateFeedUrl(string? url)
        {
            if (!Uri.TryCreate(url?.Trim(), UriKind.Absolute, out var uri)) return "Paste the full calendar link (starting with https://).";
            if (uri.Scheme != Uri.UriSchemeHttps) return "Calendar links must start with https://.";
            if (!string.IsNullOrEmpty(uri.UserInfo)) return "Calendar links can't contain a username or password.";
            if (!uri.IsDefaultPort) return "Calendar links must use the standard https port.";
            if (uri.HostNameType is UriHostNameType.IPv4 or UriHostNameType.IPv6) return "Use the calendar link from Airbnb / Booking.com, not an IP address.";
            if (uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase) || uri.Host.EndsWith(".local", StringComparison.OrdinalIgnoreCase) || uri.Host.EndsWith(".internal", StringComparison.OrdinalIgnoreCase))
                return "That calendar link isn't reachable from the internet.";
            return null;
        }

        /// <summary>Downloads and applies one feed: its events replace the feed's previous blocks.</summary>
        public async Task<(bool Ok, string Message)> SyncFeedAsync(CalendarFeed feed, CancellationToken ct = default)
        {
            try
            {
                var events = await FetchEventsAsync(feed.Url, ct);
                var today = DateTime.UtcNow.Date;
                var future = events.Where(e => e.End > today && e.End > e.Start && e.End - e.Start <= TimeSpan.FromDays(366)).ToList();

                await using var tx = await _db.Database.BeginTransactionAsync(ct);
                await _db.PropertyCalendars.Where(c => c.FeedId == feed.Id).ExecuteDeleteAsync(ct);
                foreach (var e in future)
                {
                    _db.PropertyCalendars.Add(new PropertyCalendar
                    {
                        PropertyId = feed.PropertyId,
                        StartDate = e.Start,
                        EndDate = e.End,
                        Source = "feed",
                        FeedId = feed.Id,
                        ExternalUid = e.Uid.Length > 255 ? e.Uid[..255] : e.Uid,
                        Note = string.IsNullOrWhiteSpace(e.Summary) ? feed.Name : $"{feed.Name}: {(e.Summary.Length > 80 ? e.Summary[..80] : e.Summary)}"
                    });
                }
                feed.LastSyncedAt = DateTime.UtcNow;
                feed.LastError = null;
                feed.EventCount = future.Count;
                await _db.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);
                return (true, $"Synced {future.Count} upcoming reservation{(future.Count == 1 ? "" : "s")} from {feed.Name}.");
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _db.ChangeTracker.Clear();
                var message = ex switch
                {
                    HttpRequestException h when h.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Forbidden or HttpStatusCode.Unauthorized
                        => "The calendar link was rejected. Copy a fresh export link from the other site.",
                    HttpRequestException => "Couldn't reach the calendar link.",
                    TaskCanceledException => "The calendar link took too long to respond.",
                    InvalidDataException d => d.Message,
                    _ => "Couldn't read that calendar."
                };
                _logger.LogWarning(ex, "Calendar feed {FeedId} sync failed", feed.Id);
                await _db.CalendarFeeds.Where(f => f.Id == feed.Id).ExecuteUpdateAsync(s => s
                    .SetProperty(f => f.LastError, message)
                    .SetProperty(f => f.LastSyncedAt, DateTime.UtcNow), ct);
                return (false, message);
            }
        }

        private async Task<List<ImportedEvent>> FetchEventsAsync(string url, CancellationToken ct)
        {
            var client = _http.CreateClient(HttpClientName);
            using var response = await client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, ct);
            response.EnsureSuccessStatusCode();
            if (response.Content.Headers.ContentLength > MaxBytes) throw new InvalidDataException("That calendar is too large to import.");

            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            using var limited = new MemoryStream();
            var buffer = new byte[81920];
            int read;
            while ((read = await stream.ReadAsync(buffer, ct)) > 0)
            {
                if (limited.Length + read > MaxBytes) throw new InvalidDataException("That calendar is too large to import.");
                limited.Write(buffer, 0, read);
            }
            var text = Encoding.UTF8.GetString(limited.ToArray());
            if (!text.Contains("BEGIN:VCALENDAR", StringComparison.OrdinalIgnoreCase))
                throw new InvalidDataException("That link isn't an iCal calendar. Use the “export calendar” link ending in .ics.");
            return Parse(text);
        }

        /// <summary>Minimal RFC 5545 reader: VEVENT UID / DTSTART / DTEND / SUMMARY, all-day or timed.</summary>
        public static List<ImportedEvent> Parse(string ics)
        {
            // Unfold continuation lines (a line starting with space/tab continues the previous one).
            var lines = new List<string>();
            foreach (var raw in ics.Replace("\r\n", "\n").Split('\n'))
            {
                if ((raw.StartsWith(' ') || raw.StartsWith('\t')) && lines.Count > 0) lines[^1] += raw[1..];
                else lines.Add(raw.TrimEnd('\r'));
            }

            var events = new List<ImportedEvent>();
            Dictionary<string, string>? current = null;
            foreach (var line in lines)
            {
                if (line.Equals("BEGIN:VEVENT", StringComparison.OrdinalIgnoreCase)) { current = new(StringComparer.OrdinalIgnoreCase); continue; }
                if (line.Equals("END:VEVENT", StringComparison.OrdinalIgnoreCase) && current != null)
                {
                    var start = ParseDate(current.GetValueOrDefault("DTSTART"));
                    var end = ParseDate(current.GetValueOrDefault("DTEND")) ?? start?.AddDays(1);
                    if (start != null && end != null)
                        events.Add(new ImportedEvent(current.GetValueOrDefault("UID") ?? $"{start:yyyyMMdd}-{end:yyyyMMdd}", start.Value, end.Value,
                            current.GetValueOrDefault("SUMMARY")?.Replace("\\,", ",").Replace("\\;", ";")));
                    current = null;
                    continue;
                }
                if (current == null) continue;
                var colon = line.IndexOf(':');
                if (colon <= 0) continue;
                var name = line[..colon].Split(';')[0];
                if (name is "DTSTART" or "DTEND" or "UID" or "SUMMARY") current[name] = line[(colon + 1)..].Trim();
            }
            return events;
        }

        /// <summary>Reduces any DATE or DATE-TIME to the calendar day (UTC midnight), matching how bookings are stored.</summary>
        private static DateTime? ParseDate(string? value)
        {
            if (string.IsNullOrWhiteSpace(value) || value.Length < 8) return null;
            return DateTime.TryParseExact(value[..8], "yyyyMMdd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)
                ? DateTime.SpecifyKind(d, DateTimeKind.Utc)
                : null;
        }

        // ------------------------------------------------------------------
        // Outbound HTTP that can't be pointed at internal addresses
        // ------------------------------------------------------------------

        /// <summary>
        /// HTTP handler for feed downloads. It resolves the host itself and only connects to public IP addresses,
        /// so a pasted URL (or a DNS trick) can't reach localhost, the cloud metadata service or private networks.
        /// </summary>
        public static SocketsHttpHandler CreateSafeHandler() => new()
        {
            AllowAutoRedirect = true,
            MaxAutomaticRedirections = 3,
            ConnectTimeout = TimeSpan.FromSeconds(10),
            ConnectCallback = async (context, ct) =>
            {
                var addresses = await Dns.GetHostAddressesAsync(context.DnsEndPoint.Host, ct);
                var target = addresses.FirstOrDefault(IsPublic)
                    ?? throw new HttpRequestException("Calendar host resolves to a non-public address.");
                var socket = new Socket(target.AddressFamily, SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
                try
                {
                    await socket.ConnectAsync(new IPEndPoint(target, context.DnsEndPoint.Port), ct);
                    return new NetworkStream(socket, ownsSocket: true);
                }
                catch
                {
                    socket.Dispose();
                    throw;
                }
            }
        };

        private static bool IsPublic(IPAddress ip)
        {
            if (ip.IsIPv4MappedToIPv6) ip = ip.MapToIPv4();
            if (IPAddress.IsLoopback(ip)) return false;
            if (ip.AddressFamily == AddressFamily.InterNetwork)
            {
                var b = ip.GetAddressBytes();
                return !(b[0] == 10 || b[0] == 0 || b[0] == 127 || b[0] >= 224 ||
                         (b[0] == 172 && b[1] >= 16 && b[1] <= 31) ||
                         (b[0] == 192 && b[1] == 168) ||
                         (b[0] == 169 && b[1] == 254) ||
                         (b[0] == 100 && b[1] >= 64 && b[1] <= 127));
            }
            return !(ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal || ip.IsIPv6Multicast || ip.Equals(IPAddress.IPv6None) ||
                     (ip.GetAddressBytes()[0] & 0xFE) == 0xFC); // fc00::/7 unique-local
        }
    }
}
