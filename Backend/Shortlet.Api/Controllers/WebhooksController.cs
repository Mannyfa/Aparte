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
using Shortlet.Core.Interfaces; 
using Shortlet.Infrastructure.Data;
using Shortlet.Core.Entities; // ADDED: Required for Wallet and Transaction

namespace Shortlet.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WebhooksController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly string _secretKey;
        private readonly IEmailService _emailService;

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

                Console.WriteLine("🚨 DING DING DING! PAYSTACK JUST HIT THE WEBHOOK! 🚨");
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

                    // Get the booking AND include the Property info so we have the title for the email and the HostId for the wallet
                    var booking = await _context.Bookings
                        .Include(b => b.Property)
                        .FirstOrDefaultAsync(b => b.PaymentReference == reference);
                    
                    if (booking != null && booking.Status == "pending")
                    {
                        // A. Mark Booking as Paid
                        booking.Status = "paid";

                        // --- NEW FINANCIAL LEDGER LOGIC START ---

                        // B. THE MONEY MATH (5% Platform Commission)
                        // Note: Change 'TotalPrice' to 'Amount' or whatever your Booking entity uses for the price if you get a red squiggle!
                        decimal totalAmount = booking.TotalPrice; 
                        decimal platformFee = totalAmount * 0.05m;
                        decimal hostEarnings = totalAmount - platformFee;

                        // C. Find the Host's Wallet (or create one if this is their first booking)
                        var wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.HostId == booking.Property.HostId);
                        if (wallet == null)
                        {
                            wallet = new Wallet { HostId = booking.Property.HostId, Balance = 0 };
                            _context.Wallets.Add(wallet);
                        }

                        // D. Credit the Host's Wallet
                        wallet.Balance += hostEarnings;
                        wallet.UpdatedAt = DateTime.UtcNow;

                        // E. Generate an immutable receipt (Transaction record)
                        var transaction = new Transaction
                        {
                            WalletId = wallet.Id,
                            Amount = hostEarnings,
                            Type = "Credit",
                            Description = $"Earnings from '{booking.Property.Title}' (Less 5% platform fee)",
                            Reference = reference
                        };
                        _context.Transactions.Add(transaction);

                        // --- NEW FINANCIAL LEDGER LOGIC END ---

                        // Save the Booking, Wallet, and Transaction to the database all at once
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