// Backend/Shortlet.Api/Controllers/ReferralsController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shortlet.Api.Helpers;
using Shortlet.Api.Services;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Controllers
{
    [ApiController]
    [Route("api/referrals")]
    [Authorize]
    public class ReferralsController : ControllerBase
    {
        private const string CodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0, O, 1, I
        private const int CodeLength = 8;
        private const decimal MaxCreditShare = 0.5m;

        private readonly AppDbContext _context;
        private readonly CreditService _credits;
        private readonly IConfiguration _config;

        public ReferralsController(AppDbContext context, CreditService credits, IConfiguration config)
        {
            _context = context;
            _credits = credits;
            _config = config;
        }

        private string FrontendUrl(string path) =>
            (_config["Frontend:BaseUrl"] ?? "https://aparteyng.vercel.app").TrimEnd('/') + path;

        private static string NewCode() =>
            new string(Enumerable.Range(0, CodeLength)
                .Select(_ => CodeAlphabet[System.Security.Cryptography.RandomNumberGenerator.GetInt32(CodeAlphabet.Length)]).ToArray());

        [HttpGet("me")]
        public async Task<IActionResult> GetMine()
        {
            var myId = User.GetUserId();
            if (myId == null) return Unauthorized();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == myId.Value);
            if (user == null) return Unauthorized();

            if (string.IsNullOrEmpty(user.ReferralCode))
            {
                for (var attempt = 0; attempt < 10; attempt++)
                {
                    var code = NewCode();
                    if (await _context.Users.AnyAsync(u => u.ReferralCode == code)) continue;
                    user.ReferralCode = code;
                    try { await _context.SaveChangesAsync(); break; }
                    catch (DbUpdateException)
                    {
                        user.ReferralCode = null; // collided with a concurrent request; retry with a new code
                    }
                }
                if (string.IsNullOrEmpty(user.ReferralCode))
                    return StatusCode(500, new { message = "Could not create your referral code. Please try again." });
            }

            var balance = await _credits.GetBalanceAsync(user.Id);
            var referredCount = await _context.Users.CountAsync(u => u.ReferredById == user.Id && u.ReferralRewardPaidAt != null);
            var credits = await _context.UserCredits
                .Where(c => c.UserId == user.Id)
                .OrderByDescending(c => c.CreatedAt)
                .Take(20)
                .Select(c => new { amount = c.Amount, reason = c.Reason, createdAt = c.CreatedAt })
                .ToListAsync();

            return Ok(new
            {
                code = user.ReferralCode,
                link = FrontendUrl("/register?ref=" + user.ReferralCode),
                rewardAmount = MoneyMaintenanceWorker.ReferralRewardAmount,
                maxCreditShare = MaxCreditShare,
                balance,
                referredCount,
                credits
            });
        }
    }
}
