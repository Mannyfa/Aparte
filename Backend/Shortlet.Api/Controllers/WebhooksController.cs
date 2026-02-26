// Backend/Shortlet.Api/Controllers/WebhooksController.cs
using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Shortlet.Core.Interfaces; // Required for IEmailService
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WebhooksController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly string _secretKey;
        private readonly IEmailService _emailService;

        // Fixed the constructor to properly inject IEmailService
        public WebhooksController(AppDbContext context, IConfiguration config, IEmailService emailService)
        {
            _context = context;
            _secretKey = config["Paystack:SecretKey"] ?? throw new Exception("Paystack key missing");
            _emailService = emailService;
        }

        [HttpPost("paystack")]
        public async Task<IActionResult> PaystackWebhook()
        {
            try
            {
                // 1. Read the body as a raw string
                using var reader = new StreamReader(Request.Body);
                var body = await reader.ReadToEndAsync();

                // 2. Get Paystack's signature from the headers
                var paystackSignature = Request.Headers["x-paystack-signature"].ToString();
                if (string.IsNullOrEmpty(paystackSignature)) return BadRequest("No signature found");

                // 3. Verify the signature (Security Check)
                var expectedSignature = ComputeHmacSha512(body, _secretKey);
                if (expectedSignature.ToLower() != paystackSignature.ToLower())
                    return Unauthorized("Invalid signature");

                // 4. Parse the event
                var payload = JsonDocument.Parse(body).RootElement;
                var eventName = payload.GetProperty("event").GetString();

                // 5. Handle a successful payment
                if (eventName == "charge.success")
                {
                    var data = payload.GetProperty("data");
                    var reference = data.GetProperty("reference").GetString();
                    var guestEmail = data.GetProperty("customer").GetProperty("email").GetString();

                    // Get the booking AND include the Property info so we have the title for the email
                    var booking = await _context.Bookings
                        .Include(b => b.Property)
                        .FirstOrDefaultAsync(b => b.PaymentReference == reference);
                    
                    if (booking != null && booking.Status == "pending")
                    {
                        booking.Status = "paid"; // THE MAGIC HAPPENS HERE
                        await _context.SaveChangesAsync();

                        // 6. FIRE THE EMAIL!
                        try 
                        {
                            await _emailService.SendBookingConfirmationAsync(
                                guestEmail, 
                                "Valued Guest", 
                                booking.Property.Title, 
                                booking.PaymentReference
                            );
                        }
                        catch (Exception emailEx)
                        {
                            // We catch the error so a failed email doesn't crash the webhook!
                            Console.WriteLine($"Database updated, but email failed: {emailEx.Message}");
                        }
                    }
                }

                return Ok(); // Always return 200 OK to Paystack so they stop retrying
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        private static string ComputeHmacSha512(string text, string key)
        {
            byte[] keyBytes = Encoding.UTF8.GetBytes(key);
            byte[] textBytes = Encoding.UTF8.GetBytes(text);

            using var hmac = new HMACSHA512(keyBytes);
            byte[] hashBytes = hmac.ComputeHash(textBytes);
            return BitConverter.ToString(hashBytes).Replace("-", "").ToLower();
        }
    }
}