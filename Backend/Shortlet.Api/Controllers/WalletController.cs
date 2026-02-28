// Backend/Shortlet.Api/Controllers/WalletController.cs
using System;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Shortlet.Core.Entities;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Controllers
{
    // A quick DTO to catch the data from React
    public class WithdrawRequestDto
    {
        public decimal Amount { get; set; }
        public string AccountNumber { get; set; }
        public string BankCode { get; set; }
    }

    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class WalletController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly string _paystackSecret;

        public WalletController(AppDbContext context, IConfiguration config)
        {
            _context = context;
            _paystackSecret = config["Paystack:SecretKey"] ?? throw new Exception("Paystack key missing");
        }

        [HttpGet]
        public async Task<IActionResult> GetWallet()
        {
            try
            {
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userIdClaim)) return Unauthorized();

                var hostId = Guid.Parse(userIdClaim);

                var wallet = await _context.Wallets
                    .Include(w => w.Transactions.OrderByDescending(t => t.Date).Take(10))
                    .FirstOrDefaultAsync(w => w.HostId == hostId);

                if (wallet == null)
                {
                    return Ok(new { balance = 0, pendingClearance = 0, transactions = Array.Empty<object>() });
                }

                return Ok(new 
                {
                    balance = wallet.Balance,
                    pendingClearance = wallet.PendingClearance,
                    transactions = wallet.Transactions
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        // --- NEW: THE PAYOUT ENGINE ---
        [HttpPost("withdraw")]
        public async Task<IActionResult> WithdrawFunds([FromBody] WithdrawRequestDto request)
        {
            try
            {
                // 1. Security Check: Who is withdrawing?
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userIdClaim)) return Unauthorized();
                var hostId = Guid.Parse(userIdClaim);

                // 2. Fetch Wallet & Check Balance
                var wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.HostId == hostId);
                if (wallet == null || wallet.Balance < request.Amount)
                {
                    return BadRequest(new { message = "Insufficient funds in your wallet." });
                }
                if (request.Amount < 1000)
                {
                    return BadRequest(new { message = "Minimum withdrawal is ₦1,000." });
                }

                using var client = new HttpClient();
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _paystackSecret);

                // 3. STEP A: Create Paystack Transfer Recipient
                var recipientPayload = new
                {
                    type = "nuban",
                    name = "Host Account", // In production, verify account name first
                    account_number = request.AccountNumber,
                    bank_code = request.BankCode,
                    currency = "NGN"
                };

                var recipientContent = new StringContent(JsonSerializer.Serialize(recipientPayload), Encoding.UTF8, "application/json");
                var recipientRes = await client.PostAsync("https://api.paystack.co/transferrecipient", recipientContent);
                var recipientJson = JsonDocument.Parse(await recipientRes.Content.ReadAsStringAsync()).RootElement;

                if (!recipientRes.IsSuccessStatusCode)
                {
                    return BadRequest(new { message = "Invalid Bank Account Details." });
                }

                var recipientCode = recipientJson.GetProperty("data").GetProperty("recipient_code").GetString();

                // 4. STEP B: Initiate the Transfer (Amount must be in Kobo)
                var transferPayload = new
                {
                    source = "balance",
                    amount = request.Amount * 100, // Convert Naira to Kobo
                    recipient = recipientCode,
                    reason = "Shortlet Earnings Withdrawal"
                };

                var transferContent = new StringContent(JsonSerializer.Serialize(transferPayload), Encoding.UTF8, "application/json");
                var transferRes = await client.PostAsync("https://api.paystack.co/transfer", transferContent);
                var transferJson = JsonDocument.Parse(await transferRes.Content.ReadAsStringAsync()).RootElement;

                if (!transferRes.IsSuccessStatusCode)
                {
                    var errorMsg = transferJson.GetProperty("message").GetString();
                    return BadRequest(new { message = $"Transfer Failed: {errorMsg}" });
                }

                // 5. SUCCESS! Deduct from Database Ledger
                wallet.Balance -= request.Amount;
                wallet.UpdatedAt = DateTime.UtcNow;

                var transaction = new Transaction
                {
                    WalletId = wallet.Id,
                    Amount = request.Amount,
                    Type = "Withdrawal",
                    Description = $"Bank Withdrawal (Acct: ****{request.AccountNumber.Substring(Math.Max(0, request.AccountNumber.Length - 4))})",
                    Reference = transferJson.GetProperty("data").GetProperty("reference").GetString()
                };

                _context.Transactions.Add(transaction);
                await _context.SaveChangesAsync();

                return Ok(new { message = "Withdrawal successful!", balance = wallet.Balance });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }
    }
}