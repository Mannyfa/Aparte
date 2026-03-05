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
using Shortlet.Core.Entities;
using System.Linq;

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
            _secretKey = config["PaystackSettings:SecretKey"] ?? config["Paystack:SecretKey"] ?? throw new Exception("Paystack key missing");
            _emailService = emailService;
        }

        [HttpPost("paystack")]
        public async Task<IActionResult> PaystackWebhook()
        {
            try
            {
                Console.WriteLine("🚨 DING DING DING! PAYSTACK JUST HIT THE WEBHOOK! 🚨");
                
                using var reader = new StreamReader(Request.Body);
                var body = await reader.ReadToEndAsync();

                var paystackSignature = Request.Headers["x-paystack-signature"].ToString();
                if (string.IsNullOrEmpty(paystackSignature)) return BadRequest("No signature found");

                var expectedSignature = ComputeHmacSha512(body, _secretKey);
                if (expectedSignature.ToLower() != paystackSignature.ToLower())
                    return Unauthorized("Invalid signature");

                var payload = JsonDocument.Parse(body).RootElement;
                var eventName = payload.GetProperty("event").GetString();

                if (eventName == "charge.success")
                {
                    var data = payload.GetProperty("data");
                    var reference = data.GetProperty("reference").GetString(); 
                    var guestEmail = data.GetProperty("customer").GetProperty("email").GetString();

                    if (Guid.TryParse(reference, out Guid bookingId))
                    {
                        var booking = await _context.Bookings
                            .Include(b => b.Property)
                            .FirstOrDefaultAsync(b => b.Id == bookingId); 
                        
                        if (booking != null && booking.Status == "pending")
                        {
                            Console.WriteLine($"✅ Verified Booking {booking.Id}. Processing Escrow Math...");
                            
                            booking.Status = "paid";

                            // --- FINANCIAL LEDGER LOGIC START ---

                            // 1. Lock the Escrow Vault
                            if (booking.CautionFeeAmount > 0)
                            {
                                booking.CautionFeeStatus = "Held";
                                Console.WriteLine($"🔒 Escrow Locked: ₦{booking.CautionFeeAmount:N0} for Caution Fee.");
                            }

                            // 2. Sum up the Add-Ons (Host keeps 100% of these)
                            decimal addOnsTotal = await _context.BookingAddOns
                                .Where(a => a.BookingId == booking.Id)
                                .SumAsync(a => a.Price);

                            // 3. FLAWLESS SPLIT: Remove Escrow and Add-Ons to find the Room Rate + Fee
                            decimal roomWithFee = booking.TotalPrice - booking.CautionFeeAmount - addOnsTotal;
                            
                            // 4. Extract the 5% Platform Fee from the room
                            decimal roomRate = roomWithFee / 1.05m;
                            decimal platformFee = roomWithFee - roomRate;

                            // 5. Final Host Earnings (Room Rate + Add Ons)
                            decimal hostEarnings = roomRate + addOnsTotal;

                            // Find the Host's Wallet
                            var wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.HostId == booking.Property.HostId);
                            if (wallet == null)
                            {
                                wallet = new Wallet { HostId = booking.Property.HostId, Balance = 0 };
                                _context.Wallets.Add(wallet);
                            }

                            // Credit the Host's Wallet
                            wallet.Balance += hostEarnings;
                            wallet.UpdatedAt = DateTime.UtcNow;

                            // Generate an immutable receipt
                            var transaction = new Transaction
                            {
                                WalletId = wallet.Id,
                                Amount = hostEarnings,
                                Type = "Credit",
                                Description = $"Room Earnings & Add-Ons (Escrow Held: ₦{booking.CautionFeeAmount})",
                                Reference = booking.Id.ToString()
                            };
                            _context.Transactions.Add(transaction);

                            // --- FINANCIAL LEDGER LOGIC END ---

                            await _context.SaveChangesAsync();
                            Console.WriteLine($"💰 Wallet updated! Host earned: ₦{hostEarnings:N0}");

                            // FIRE THE EMAIL!
                            try 
                            {
                                await _emailService.SendBookingConfirmationAsync(
                                    guestEmail, 
                                    "Valued Guest", 
                                    booking.Property.Title, 
                                    booking.CheckInCode
                                );
                                Console.WriteLine("📧 Confirmation Email Sent!");
                            }
                            catch (Exception emailEx)
                            {
                                Console.WriteLine($"⚠️ Database updated, but email failed: {emailEx.Message}");
                            }
                        }
                        else
                        {
                            Console.WriteLine($"⚠️ Booking {bookingId} not found or already paid.");
                        }
                    }
                }

                return Ok(); 
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ CRITICAL WEBHOOK ERROR: {ex.Message}");
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