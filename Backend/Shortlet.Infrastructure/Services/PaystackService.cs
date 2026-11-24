// Backend/Shortlet.Infrastructure/Services/PaystackService.cs
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Shortlet.Core.Interfaces;

namespace Shortlet.Infrastructure.Services
{
    public class PaystackService : IPaystackService
    {
        private const string BaseUrl = "https://api.paystack.co";
        private readonly HttpClient _httpClient;
        private readonly string? _secretKey;

        public PaystackService(HttpClient httpClient, IConfiguration config)
        {
            _httpClient = httpClient;
            _secretKey = config["Paystack:SecretKey"];
        }

        private HttpRequestMessage NewRequest(string path, object payload)
        {
            if (string.IsNullOrEmpty(_secretKey))
                throw new InvalidOperationException("Paystack:SecretKey is not configured.");

            var request = new HttpRequestMessage(HttpMethod.Post, BaseUrl + path)
            {
                Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _secretKey);
            return request;
        }

        public async Task<string> InitializePaymentAsync(decimal amount, string reference, string email, string callbackUrl)
        {
            var payload = new
            {
                email,
                amount = (long)Math.Round(amount * 100, MidpointRounding.AwayFromZero), // Naira -> Kobo
                reference,
                callback_url = callbackUrl
            };

            using var response = await _httpClient.SendAsync(NewRequest("/transaction/initialize", payload));
            var body = await response.Content.ReadAsStringAsync();
            using var json = JsonDocument.Parse(body);

            if (!response.IsSuccessStatusCode)
            {
                var message = json.RootElement.TryGetProperty("message", out var m) ? m.GetString() : response.ReasonPhrase;
                throw new InvalidOperationException($"Paystack rejected the payment: {message}");
            }

            return json.RootElement.GetProperty("data").GetProperty("authorization_url").GetString()!;
        }

        public async Task<(bool Success, string Message)> RefundAsync(string transactionReference)
        {
            using var response = await _httpClient.SendAsync(NewRequest("/refund", new { transaction = transactionReference }));
            var body = await response.Content.ReadAsStringAsync();
            string message = response.ReasonPhrase ?? "";
            try
            {
                using var json = JsonDocument.Parse(body);
                if (json.RootElement.TryGetProperty("message", out var m)) message = m.GetString() ?? message;
            }
            catch (JsonException) { /* non-JSON error body */ }

            return (response.IsSuccessStatusCode, message);
        }
    }
}
