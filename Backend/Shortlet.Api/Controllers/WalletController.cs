// Backend/Shortlet.Api/Controllers/WalletController.cs
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shortlet.Api.Helpers;
using Shortlet.Core.Entities;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Controllers
{
    public class WithdrawRequestDto
    {
        public decimal Amount { get; set; }
        public string AccountNumber { get; set; } = string.Empty;
        public string BankCode { get; set; } = string.Empty;
    }

    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class WalletController : ControllerBase
    {
        private const decimal MinimumWithdrawal = 1000m;

        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<WalletController> _logger;

        public WalletController(AppDbContext context, IConfiguration config, IHttpClientFactory httpClientFactory, ILogger<WalletController> logger)
        {
            _context = context;
            _config = config;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        [HttpGet]
        public async Task<IActionResult> GetWallet()
        {
            var hostId = User.GetUserId();
            if (hostId == null) return Unauthorized();

            var wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.HostId == hostId.Value);
            if (wallet == null)
                return Ok(new { balance = 0, pendingClearance = 0, transactions = Array.Empty<object>() });

            var transactions = await _context.Transactions
                .Where(t => t.WalletId == wallet.Id)
                .OrderByDescending(t => t.Date)
                .Take(10)
                .Select(t => new { t.Id, t.Amount, t.Type, t.Description, t.Reference, t.Date })
                .ToListAsync();

            return Ok(new { balance = wallet.Balance, pendingClearance = wallet.PendingClearance, transactions });
        }

        [HttpPost("withdraw")]
        public async Task<IActionResult> WithdrawFunds([FromBody] WithdrawRequestDto request)
        {
            var hostId = User.GetUserId();
            if (hostId == null) return Unauthorized();

            if (request.Amount < MinimumWithdrawal)
                return BadRequest(new { message = $"Minimum withdrawal is ₦{MinimumWithdrawal:N0}." });
            if (request.AccountNumber.Length != 10 || !request.AccountNumber.All(char.IsDigit))
                return BadRequest(new { message = "Account number must be 10 digits." });
            if (string.IsNullOrWhiteSpace(request.BankCode))
                return BadRequest(new { message = "Please choose a bank." });

            var secret = _config["Paystack:SecretKey"];
            if (string.IsNullOrEmpty(secret)) return StatusCode(500, new { message = "Payouts are not configured." });

            var amount = Math.Round(request.Amount, 2);
            var payoutReference = $"WD-{Guid.NewGuid():N}";
            var last4 = request.AccountNumber[^4..];

            // 1. Reserve the money first (locked), so two simultaneous requests can't both spend the same balance.
            Guid walletId;
            await using (var tx = await _context.Database.BeginTransactionAsync())
            {
                var wallet = await WalletLedger.LockWalletAsync(_context, hostId.Value);
                if (wallet.Balance < amount)
                    return BadRequest(new { message = "Insufficient funds in your wallet." });

                wallet.Balance -= amount;
                wallet.UpdatedAt = DateTime.UtcNow;
                _context.Transactions.Add(new Transaction
                {
                    WalletId = wallet.Id,
                    Amount = amount,
                    Type = "Withdrawal",
                    Description = $"Bank Withdrawal (Acct: ****{last4})",
                    Reference = payoutReference
                });
                await _context.SaveChangesAsync();
                await tx.CommitAsync();
                walletId = wallet.Id;
            }

            // 2. Ask Paystack to pay out. If that fails, give the money back.
            var (ok, error) = await SendPayoutAsync(secret, request, amount, payoutReference);
            if (ok)
            {
                var balance = await _context.Wallets.Where(w => w.Id == walletId).Select(w => w.Balance).FirstAsync();
                return Ok(new { message = "Withdrawal initiated!", balance });
            }

            await using (var tx = await _context.Database.BeginTransactionAsync())
            {
                var wallet = await WalletLedger.LockWalletAsync(_context, hostId.Value);
                wallet.Balance += amount;
                wallet.UpdatedAt = DateTime.UtcNow;
                _context.Transactions.Add(new Transaction
                {
                    WalletId = wallet.Id,
                    Amount = amount,
                    Type = "Credit",
                    Description = "Reversal of failed withdrawal",
                    Reference = payoutReference + "_reversal"
                });
                await _context.SaveChangesAsync();
                await tx.CommitAsync();
            }
            return BadRequest(new { message = error });
        }

        private async Task<(bool Ok, string Error)> SendPayoutAsync(string secret, WithdrawRequestDto request, decimal amount, string reference)
        {
            try
            {
                var client = _httpClientFactory.CreateClient();
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", secret);

                // A. Create the transfer recipient
                var recipientRes = await client.PostAsync("https://api.paystack.co/transferrecipient", Json(new
                {
                    type = "nuban",
                    name = "Host Account",
                    account_number = request.AccountNumber,
                    bank_code = request.BankCode,
                    currency = "NGN"
                }));
                using var recipientJson = JsonDocument.Parse(await recipientRes.Content.ReadAsStringAsync());
                if (!recipientRes.IsSuccessStatusCode) return (false, "Invalid bank account details.");
                var recipientCode = recipientJson.RootElement.GetProperty("data").GetProperty("recipient_code").GetString();

                // B. Initiate the transfer (amount in kobo, as an integer)
                var transferRes = await client.PostAsync("https://api.paystack.co/transfer", Json(new
                {
                    source = "balance",
                    amount = (long)Math.Round(amount * 100, MidpointRounding.AwayFromZero),
                    recipient = recipientCode,
                    reference,
                    reason = "Apartey Earnings Withdrawal"
                }));
                using var transferJson = JsonDocument.Parse(await transferRes.Content.ReadAsStringAsync());
                if (!transferRes.IsSuccessStatusCode)
                {
                    var msg = transferJson.RootElement.TryGetProperty("message", out var m) ? m.GetString() : "unknown error";
                    return (false, $"Transfer failed: {msg}");
                }
                return (true, string.Empty);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Payout {Reference} failed", reference);
                return (false, "Transfer failed. Please try again later.");
            }
        }

        private static StringContent Json(object payload) =>
            new(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
    }
}
