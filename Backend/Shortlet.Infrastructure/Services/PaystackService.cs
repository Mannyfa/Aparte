// Backend/Shortlet.Infrastructure/Services/PaystackService.cs
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Shortlet.Core.Interfaces;

namespace Shortlet.Infrastructure.Services
{
    /// <summary>The only place in the app that talks to the Paystack API.</summary>
    public class PaystackService : IPaystackService
    {
        private const string BaseUrl = "https://api.paystack.co";
        private readonly HttpClient _httpClient;
        private readonly IMemoryCache _cache;
        private readonly string? _secretKey;

        public PaystackService(HttpClient httpClient, IConfiguration config, IMemoryCache cache)
        {
            _httpClient = httpClient;
            _cache = cache;
            _secretKey = config["Paystack:SecretKey"];
        }

        public static long ToKobo(decimal naira) => (long)Math.Round(naira * 100, MidpointRounding.AwayFromZero);

        private HttpRequestMessage Request(HttpMethod method, string path, object? payload = null)
        {
            if (string.IsNullOrEmpty(_secretKey))
                throw new InvalidOperationException("Paystack:SecretKey is not configured.");

            var request = new HttpRequestMessage(method, BaseUrl + path);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _secretKey);
            if (payload != null)
                request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            return request;
        }

        /// <summary>Sends a request and returns (HTTP success, parsed JSON root or null, Paystack message).</summary>
        private async Task<(bool Ok, JsonElement? Root, string Message)> SendAsync(HttpRequestMessage request)
        {
            using (request)
            using (var response = await _httpClient.SendAsync(request))
            {
                var body = await response.Content.ReadAsStringAsync();
                JsonElement? root = null;
                var message = response.ReasonPhrase ?? string.Empty;
                try
                {
                    root = JsonDocument.Parse(body).RootElement.Clone();
                    if (root.Value.TryGetProperty("message", out var m) && m.ValueKind == JsonValueKind.String)
                        message = m.GetString() ?? message;
                }
                catch (JsonException) { /* non-JSON error page */ }

                var ok = response.IsSuccessStatusCode &&
                         (root == null || !root.Value.TryGetProperty("status", out var s) || s.ValueKind != JsonValueKind.False);
                return (ok, root, message);
            }
        }

        public async Task<string> InitializePaymentAsync(decimal amount, string reference, string email, string callbackUrl)
        {
            var (ok, root, message) = await SendAsync(Request(HttpMethod.Post, "/transaction/initialize", new
            {
                email,
                amount = ToKobo(amount),
                reference,
                callback_url = callbackUrl
            }));
            if (!ok || root == null) throw new InvalidOperationException($"Paystack rejected the payment: {message}");
            return root.Value.GetProperty("data").GetProperty("authorization_url").GetString()!;
        }

        public async Task<PaystackResult> RefundAsync(string transactionReference, decimal? amount = null, string? note = null)
        {
            var payload = new Dictionary<string, object> { ["transaction"] = transactionReference };
            if (amount.HasValue) payload["amount"] = ToKobo(amount.Value);
            if (!string.IsNullOrEmpty(note)) payload["merchant_note"] = note;

            var (ok, _, message) = await SendAsync(Request(HttpMethod.Post, "/refund", payload));
            return new PaystackResult(ok, message);
        }

        public async Task<IReadOnlyList<PaystackBank>> ListBanksAsync()
        {
            return await _cache.GetOrCreateAsync("paystack:banks:ng", async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(12);
                var (ok, root, message) = await SendAsync(Request(HttpMethod.Get, "/bank?country=nigeria&perPage=200&enabled_for_verification=true"));
                if (!ok || root == null) throw new InvalidOperationException($"Could not load banks: {message}");

                return (IReadOnlyList<PaystackBank>)root.Value.GetProperty("data").EnumerateArray()
                    .Where(b => !b.TryGetProperty("active", out var a) || a.ValueKind != JsonValueKind.False)
                    .Select(b => new PaystackBank(b.GetProperty("name").GetString() ?? "", b.GetProperty("code").GetString() ?? ""))
                    .Where(b => b.Code.Length > 0)
                    .GroupBy(b => b.Code).Select(g => g.First())
                    .OrderBy(b => b.Name)
                    .ToList();
            }) ?? Array.Empty<PaystackBank>();
        }

        public async Task<string?> ResolveAccountNameAsync(string accountNumber, string bankCode)
        {
            var (ok, root, _) = await SendAsync(Request(HttpMethod.Get,
                $"/bank/resolve?account_number={Uri.EscapeDataString(accountNumber)}&bank_code={Uri.EscapeDataString(bankCode)}"));
            if (!ok || root == null) return null;
            return root.Value.GetProperty("data").TryGetProperty("account_name", out var n) ? n.GetString() : null;
        }

        public async Task<(bool Ok, string? RecipientCode, string Message)> CreateRecipientAsync(string accountName, string accountNumber, string bankCode)
        {
            var (ok, root, message) = await SendAsync(Request(HttpMethod.Post, "/transferrecipient", new
            {
                type = "nuban",
                name = accountName,
                account_number = accountNumber,
                bank_code = bankCode,
                currency = "NGN"
            }));
            if (!ok || root == null) return (false, null, message);
            return (true, root.Value.GetProperty("data").GetProperty("recipient_code").GetString(), message);
        }

        public async Task<(bool Ok, string Status, string Message)> InitiateTransferAsync(decimal amount, string recipientCode, string reference, string reason)
        {
            var (ok, root, message) = await SendAsync(Request(HttpMethod.Post, "/transfer", new
            {
                source = "balance",
                amount = ToKobo(amount),
                recipient = recipientCode,
                reference,
                reason
            }));
            if (!ok || root == null) return (false, "failed", message);
            var status = root.Value.GetProperty("data").TryGetProperty("status", out var s) ? s.GetString() ?? "pending" : "pending";
            return (true, status, message);
        }

        public async Task<PaystackTransferStatus> VerifyTransferAsync(string reference)
        {
            var (ok, root, message) = await SendAsync(Request(HttpMethod.Get, $"/transfer/verify/{Uri.EscapeDataString(reference)}"));
            if (!ok || root == null) return new PaystackTransferStatus(false, "unknown", message);
            var status = root.Value.GetProperty("data").TryGetProperty("status", out var s) ? s.GetString() ?? "unknown" : "unknown";
            return new PaystackTransferStatus(true, status, message);
        }
    }
}
