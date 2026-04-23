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
                Console.WriteLine("🚨 PAYSTACK WEBHOOK INITIATED 🚨");
                
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

                    Booking bookingToProcess = null;

                    // =================================================================
                    // BRANCH 1: APARTEY SPLIT (FRACTIONAL PAYMENT)
                    // =================================================================
                    if (reference.StartsWith("SPLIT_"))
                    {
                        var shareIdStr = reference.Substring(6); // Strip the prefix
                        if (Guid.TryParse(shareIdStr, out Guid shareId))
                        {
                            var share = await _context.SplitShares
                                .Include(s => s.SplitGroup)
                                .ThenInclude(sg => sg.Booking)
                                .ThenInclude(b => b.Property)
                                .FirstOrDefaultAsync(s => s.Id == shareId);

                            if (share != null && share.Status == "Pending")
                            {
                                share.Status = "Paid";
                                share.SplitGroup.PaidShares += 1;
                                
                                Console.WriteLine($"✅ Split Fraction Paid! ({share.SplitGroup.PaidShares}/{share.SplitGroup.TotalShares})");

                                // IS THE GROUP FULLY FUNDED?
                                if (share.SplitGroup.PaidShares == share.SplitGroup.TotalShares)
                                {
                                    Console.WriteLine("🎉 SPLIT GROUP COMPLETE! Unlocking Escrow & Booking...");
                                    share.SplitGroup.Status = "Completed";
                                    bookingToProcess = share.SplitGroup.Booking;
                                    
                                    // Send the confirmation email to the LEAD GUEST who originated the booking
                                    var leadGuest = await _context.Users.FindAsync(bookingToProcess.GuestId);
                                    if (leadGuest != null) guestEmail = leadGuest.Email; 
                                }
                                
                                // Save the fractional progress even if it's not complete yet
                                await _context.SaveChangesAsync(); 
                            }
                        }
                    }
                    // =================================================================
                    // BRANCH 2: STANDARD SOLO BOOKING
                    // =================================================================
                    else if (Guid.TryParse(reference, out Guid bookingId))
                    {
                        bookingToProcess = await _context.Bookings
                            .Include(b => b.Property)
                            .FirstOrDefaultAsync(b => b.Id == bookingId); 
                    }

                    // =================================================================
                    // THE ESCROW & PAYOUT ENGINE (Runs when 100% funded)
                    // =================================================================
                    if (bookingToProcess != null && (bookingToProcess.Status == "pending" || bookingToProcess.Status == "split_pending"))
                    {
                        Console.WriteLine($"✅ 100% Funded for Booking {bookingToProcess.Id}. Processing Escrow Math...");
                        
                        bookingToProcess.Status = "paid";

                        // 1. Lock the Escrow Vault
                        if (bookingToProcess.CautionFeeAmount > 0)
                        {
                            bookingToProcess.CautionFeeStatus = "Held";
                            Console.WriteLine($"🔒 Escrow Locked: ₦{bookingToProcess.CautionFeeAmount:N0} for Caution Fee.");
                        }

                        // 2. Sum up the Add-Ons (Host keeps 100% of these)
                        decimal addOnsTotal = await _context.BookingAddOns
                            .Where(a => a.BookingId == bookingToProcess.Id)
                            .SumAsync(a => a.Price);

                        // 3. FLAWLESS SPLIT: Remove Escrow and Add-Ons to find the Room Rate + Fee
                        decimal roomWithFee = bookingToProcess.TotalPrice - bookingToProcess.CautionFeeAmount - addOnsTotal;
                        
                        // 4. Extract the 5% Platform Fee from the room
                        decimal roomRate = roomWithFee / 1.05m;
                        decimal platformFee = roomWithFee - roomRate;

                        // 5. Final Host Earnings (Room Rate + Add Ons)
                        decimal hostEarnings = roomRate + addOnsTotal;

                        // Find the Host's Wallet
                        var wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.HostId == bookingToProcess.Property.HostId);
                        if (wallet == null)
                        {
                            wallet = new Wallet { HostId = bookingToProcess.Property.HostId, Balance = 0 };
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
                            Description = $"Room Earnings & Add-Ons (Escrow Held: ₦{bookingToProcess.CautionFeeAmount})",
                            Reference = bookingToProcess.Id.ToString()
                        };
                        _context.Transactions.Add(transaction);

                        await _context.SaveChangesAsync();
                        Console.WriteLine($"💰 Wallet updated! Host earned: ₦{hostEarnings:N0}");

                        // FIRE THE EMAIL!
                        try 
                        {
                            await _emailService.SendBookingConfirmationAsync(
                                guestEmail, 
                                "Valued Guest", 
                                bookingToProcess.Property.Title, 
                                bookingToProcess.CheckInCode
                            );
                            Console.WriteLine("📧 Confirmation Email Sent to Lead Guest!");
                        }
                        catch (Exception emailEx)
                        {
                            Console.WriteLine($"⚠️ Database updated, but email failed: {emailEx.Message}");
                        }
                    }
                }

                return Ok(); // Always return 200 OK to Paystack
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