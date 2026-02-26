// Backend/Shortlet.Infrastructure/Services/PaystackService.cs
using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Shortlet.Core.Interfaces;

namespace Shortlet.Infrastructure.Services
{
    public class PaystackService : IPaystackService
    {
        private readonly HttpClient _httpClient;
        private readonly string _secretKey;

        public PaystackService(HttpClient httpClient, IConfiguration config)
        {
            _httpClient = httpClient;
            _secretKey = config["Paystack:SecretKey"] ?? throw new Exception("Paystack key missing");
        }

        public async Task<string> InitializePaymentAsync(decimal amount, string reference, string email)
        {
            // Paystack expects amount in Kobo (multiply Naira by 100)
            var payload = new
            {
                email = email,
                amount = (long)(amount * 100), 
                reference = reference,
                callback_url = "http://localhost:5174/payment-success" // We will build this React page later
            };

            var request = new HttpRequestMessage(HttpMethod.Post, "https://api.paystack.co/transaction/initialize");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _secretKey);
            request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            var response = await _httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var responseBody = await response.Content.ReadAsStringAsync();
            var json = JsonDocument.Parse(responseBody);
            
            // Extract the checkout URL so we can redirect the user
            return json.RootElement.GetProperty("data").GetProperty("authorization_url").GetString()!;
        }
    }
}