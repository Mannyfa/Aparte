// Backend/Shortlet.Api/Controllers/WalletController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shortlet.Api.Helpers;
using Shortlet.Api.Services;
using Shortlet.Core.Entities;
using Shortlet.Core.Interfaces;
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
        private readonly IPaystackService _paystack;
        private readonly BookingFinanceService _finance;
        private readonly ILogger<WalletController> _logger;

        public WalletController(AppDbContext context, IPaystackService paystack, BookingFinanceService finance, ILogger<WalletController> logger)
        {
            _context = context;
            _paystack = paystack;
            _finance = finance;
            _logger = logger;
        }

        [HttpGet]
        public async Task<IActionResult> GetWallet()
        {
            var hostId = User.GetUserId();
            if (hostId == null) return Unauthorized();

            var wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.HostId == hostId.Value);
            if (wallet == null)
                return Ok(new { balance = 0, pendingClearance = 0, pendingWithdrawals = 0, transactions = Array.Empty<object>() });

            var transactions = await _context.Transactions
                .Where(t => t.WalletId == wallet.Id)
                .OrderByDescending(t => t.Date)
                .Take(20)
                .Select(t => new { t.Id, t.Amount, t.Type, t.Description, t.Reference, t.Status, t.Date })
                .ToListAsync();

            var pendingWithdrawals = await _context.Transactions
                .Where(t => t.WalletId == wallet.Id && t.Type == "Withdrawal" && t.Status == "Pending")
                .SumAsync(t => t.Amount);

            return Ok(new { balance = wallet.Balance, pendingClearance = wallet.PendingClearance, pendingWithdrawals, transactions });
        }

        /// <summary>Banks Paystack can pay out to (cached for 12 hours).</summary>
        [HttpGet("banks")]
        public async Task<IActionResult> GetBanks()
        {
            try
            {
                var banks = await _paystack.ListBanksAsync();
                return Ok(banks.Select(b => new { b.Name, b.Code }));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Could not load bank list");
                return StatusCode(502, new { message = "Couldn't load the bank list. Please try again." });
            }
        }

        /// <summary>Looks up the account holder's name so the host can confirm it before withdrawing.</summary>
        [HttpGet("resolve-account")]
        public async Task<IActionResult> ResolveAccount([FromQuery] string accountNumber, [FromQuery] string bankCode)
        {
            if (accountNumber?.Length != 10 || !accountNumber.All(char.IsDigit) || string.IsNullOrWhiteSpace(bankCode))
                return BadRequest(new { message = "Enter a 10-digit account number and choose a bank." });

            var name = await _paystack.ResolveAccountNameAsync(accountNumber, bankCode);
            return name == null
                ? NotFound(new { message = "We couldn't find that account. Check the number and bank." })
                : Ok(new { accountName = name });
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

            // 1. Confirm the account exists and get the holder's real name (never trust a name from the browser).
            var accountName = await _paystack.ResolveAccountNameAsync(request.AccountNumber, request.BankCode);
            if (accountName == null)
                return BadRequest(new { message = "We couldn't verify that bank account. Check the number and bank." });

            var amount = Math.Round(request.Amount, 2);
            var payoutReference = $"WD-{Guid.NewGuid():N}";
            var last4 = request.AccountNumber[^4..];

            // 2. Reserve the money (locked) so two simultaneous requests can't spend the same balance.
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
                    Status = "Pending",
                    Description = $"To {accountName} (****{last4})",
                    Reference = payoutReference
                });
                await _context.SaveChangesAsync();
                await tx.CommitAsync();
            }

            // 3. Ask Paystack to pay out. Bank transfers finish later; the webhook / reconciler records the outcome.
            string status;
            string message;
            try
            {
                var (recipientOk, recipientCode, recipientMessage) = await _paystack.CreateRecipientAsync(accountName, request.AccountNumber, request.BankCode);
                if (!recipientOk || recipientCode == null)
                {
                    (status, message) = ("failed", recipientMessage);
                }
                else
                {
                    var (ok, transferStatus, transferMessage) = await _paystack.InitiateTransferAsync(amount, recipientCode, payoutReference, "Apartey earnings withdrawal");
                    (status, message) = (ok ? transferStatus : "failed", transferMessage);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Payout {Reference} could not be started", payoutReference);
                // We don't know whether Paystack received it: leave it Pending and let the reconciler check.
                return Ok(new { message = "Withdrawal submitted. We'll confirm it shortly.", status = "Pending" });
            }

            if (status == "otp")
                _logger.LogWarning("Payout {Reference} is waiting for OTP approval. Disable transfer OTP in the Paystack dashboard for automatic payouts.", payoutReference);

            await _finance.FinalizePayoutAsync(payoutReference, status); // no-op while still pending

            var balance = await _context.Wallets.Where(w => w.HostId == hostId.Value).Select(w => w.Balance).FirstAsync();
            return status switch
            {
                "success" => Ok(new { message = $"₦{amount:N0} sent to {accountName}.", status = "Completed", balance }),
                "failed" => BadRequest(new { message = $"Transfer failed: {message}. The money is back in your wallet.", balance }),
                _ => Ok(new { message = $"₦{amount:N0} is on its way to {accountName}. We'll update the status when the bank confirms.", status = "Pending", balance })
            };
        }
    }
}
