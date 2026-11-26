// Backend/Shortlet.Api/Controllers/AdminController.cs
using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shortlet.Api.Helpers;
using Shortlet.Core.Entities;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Controllers
{
    public class CreatePromoCodeRequest
    {
        public string? Code { get; set; }
        public string? DiscountType { get; set; }
        public decimal DiscountValue { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public int? UsageLimit { get; set; }
    }

    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AdminController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AdminController(AppDbContext context)
        {
            _context = context;
        }

        // Checked against the database (not just the token) so a demoted admin loses access immediately.
        private async Task<bool> IsAdminAsync()
        {
            var userId = User.GetUserId();
            if (userId == null) return false;
            var role = await _context.Users.Where(u => u.Id == userId.Value).Select(u => u.Role).FirstOrDefaultAsync();
            return string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase);
        }

        // NOTE: Forbid("text") treats the text as an auth *scheme* name and throws — use a 403 result instead.
        private ObjectResult AccessDenied() => StatusCode(StatusCodes.Status403Forbidden, new { message = "Access denied: admin only." });

        [HttpGet("pending-kyc")]
        public async Task<IActionResult> GetPendingKyc()
        {
            if (!await IsAdminAsync()) return AccessDenied();

            var pendingHosts = await _context.Users
                .Where(u => u.VerificationStatus == "Pending")
                .Select(u => new
                {
                    id = u.Id,
                    name = u.Name,
                    email = u.Email,
                    phone = u.Phone,
                    documentUrl = u.IdDocumentUrl,
                    documentType = u.IdDocumentType,
                    submittedAt = u.CreatedAt
                })
                .ToListAsync();

            return Ok(pendingHosts);
        }

        [HttpPost("kyc/{hostId}/approve")]
        public async Task<IActionResult> ApproveKyc(Guid hostId)
        {
            if (!await IsAdminAsync()) return AccessDenied();

            var host = await _context.Users.FindAsync(hostId);
            if (host == null) return NotFound(new { message = "Host not found." });

            host.VerificationStatus = "Verified";
            host.IsVerified = true;
            await _context.SaveChangesAsync();
            return Ok(new { message = $"Success! {host.Name} is now a Premium Host." });
        }

        [HttpPost("kyc/{hostId}/reject")]
        public async Task<IActionResult> RejectKyc(Guid hostId)
        {
            if (!await IsAdminAsync()) return AccessDenied();

            var host = await _context.Users.FindAsync(hostId);
            if (host == null) return NotFound(new { message = "Host not found." });

            host.VerificationStatus = "Unverified";
            host.IsVerified = false;
            host.IdDocumentUrl = null;
            host.IdDocumentType = null;
            await _context.SaveChangesAsync();
            return Ok(new { message = $"Rejected. {host.Name} has been bumped back to Unverified." });
        }

        private static int ClampPage(int page) => page < 1 ? 1 : page;
        private static int ClampSize(int size) => size < 1 ? 1 : size > 100 ? 100 : size;

        // ---------------- Listings ----------------

        [HttpGet("listings")]
        public async Task<IActionResult> GetListings([FromQuery] string? status, [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 25)
        {
            if (!await IsAdminAsync()) return AccessDenied();
            page = ClampPage(page);
            pageSize = ClampSize(pageSize);

            var query = _context.Properties.AsQueryable();
            if (!string.IsNullOrWhiteSpace(status))
            {
                var s = status.Trim();
                query = query.Where(p => p.Status == s);
            }
            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(p => p.Title.ToLower().Contains(term) || p.City.ToLower().Contains(term)
                    || p.Area.ToLower().Contains(term) || p.Host.Name.ToLower().Contains(term));
            }

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(p => p.CreatedAt)
                .Skip((page - 1) * pageSize).Take(pageSize)
                .Select(p => new
                {
                    id = p.Id,
                    title = p.Title,
                    city = p.City,
                    area = p.Area,
                    status = p.Status,
                    pricePerNight = p.PricePerNight,
                    hostName = p.Host.Name,
                    hostEmail = p.Host.Email,
                    createdAt = p.CreatedAt
                })
                .ToListAsync();

            return Ok(new { items, total });
        }

        [HttpPost("listings/{id}/suspend")]
        public async Task<IActionResult> SuspendListing(Guid id)
        {
            if (!await IsAdminAsync()) return AccessDenied();
            var property = await _context.Properties.FindAsync(id);
            if (property == null) return NotFound(new { message = "Listing not found." });
            property.Status = "suspended";
            await _context.SaveChangesAsync();
            PropertiesController.InvalidatePublicCache(); // hide it from public lists and the cached detail page now
            return Ok(new { status = property.Status });
        }

        [HttpPost("listings/{id}/restore")]
        public async Task<IActionResult> RestoreListing(Guid id)
        {
            if (!await IsAdminAsync()) return AccessDenied();
            var property = await _context.Properties.FindAsync(id);
            if (property == null) return NotFound(new { message = "Listing not found." });
            if (property.Status != "suspended") return Conflict(new { message = "Only suspended listings can be restored." });
            property.Status = "active";
            await _context.SaveChangesAsync();
            PropertiesController.InvalidatePublicCache(); // show it again right away
            return Ok(new { status = property.Status });
        }

        // ---------------- Bookings ----------------

        [HttpGet("bookings")]
        public async Task<IActionResult> GetBookings([FromQuery] string? status, [FromQuery] DateTime? from, [FromQuery] DateTime? to,
            [FromQuery] Guid? propertyId, [FromQuery] int page = 1, [FromQuery] int pageSize = 25)
        {
            if (!await IsAdminAsync()) return AccessDenied();
            page = ClampPage(page);
            pageSize = ClampSize(pageSize);

            var query = _context.Bookings.AsQueryable();
            if (!string.IsNullOrWhiteSpace(status))
            {
                var s = status.Trim();
                query = query.Where(b => b.Status == s);
            }
            if (from.HasValue)
            {
                var f = BookingRules.ToUtcDate(from.Value);
                query = query.Where(b => b.CheckIn >= f);
            }
            if (to.HasValue)
            {
                var t = BookingRules.ToUtcDate(to.Value);
                query = query.Where(b => b.CheckIn <= t);
            }
            if (propertyId.HasValue) query = query.Where(b => b.PropertyId == propertyId.Value);

            var total = await query.CountAsync();
            var totalAmount = await query.SumAsync(b => (decimal?)b.TotalPrice) ?? 0m;
            var items = await query
                .OrderByDescending(b => b.CreatedAt)
                .Skip((page - 1) * pageSize).Take(pageSize)
                .Select(b => new
                {
                    id = b.Id,
                    propertyTitle = b.Property.Title,
                    guestName = b.Guest.Name,
                    guestEmail = b.Guest.Email,
                    checkIn = b.CheckIn,
                    checkOut = b.CheckOut,
                    totalPrice = b.TotalPrice,
                    serviceFee = b.ServiceFee,
                    promoDiscount = b.PromoDiscount,
                    creditApplied = b.CreditApplied,
                    status = b.Status,
                    paymentReference = b.PaymentReference,
                    cautionFeeStatus = b.CautionFeeStatus,
                    createdAt = b.CreatedAt
                })
                .ToListAsync();

            return Ok(new { items, total, totalAmount });
        }

        // ---------------- Refunds ----------------

        [HttpGet("refunds")]
        public async Task<IActionResult> GetRefunds([FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 25)
        {
            if (!await IsAdminAsync()) return AccessDenied();
            page = ClampPage(page);
            pageSize = ClampSize(pageSize);

            var query = _context.Refunds.AsQueryable();
            if (!string.IsNullOrWhiteSpace(status))
            {
                var s = status.Trim();
                query = query.Where(r => r.Status == s);
            }

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(r => r.CreatedAt)
                .Skip((page - 1) * pageSize).Take(pageSize)
                .Select(r => new
                {
                    id = r.Id,
                    bookingId = r.BookingId,
                    transactionReference = r.TransactionReference,
                    amount = r.Amount,
                    purpose = r.Purpose,
                    status = r.Status,
                    failureReason = r.FailureReason,
                    attempts = r.Attempts,
                    createdAt = r.CreatedAt,
                    updatedAt = r.UpdatedAt
                })
                .ToListAsync();

            return Ok(new { items, total });
        }

        /// <summary>
        /// Re-queues a failed refund for the MoneyMaintenanceWorker (it retries Failed/Requesting refunds with
        /// Attempts &lt; Max whose last update is older than 15 minutes, and RefundOnceAsync also enforces a 15 minute backoff).
        /// </summary>
        [HttpPost("refunds/{id}/retry")]
        public async Task<IActionResult> RetryRefund(Guid id)
        {
            if (!await IsAdminAsync()) return AccessDenied();
            var refund = await _context.Refunds.FindAsync(id);
            if (refund == null) return NotFound(new { message = "Refund not found." });
            if (refund.Status != "Failed") return Conflict(new { message = "Only failed refunds can be retried." });

            refund.Attempts = 0;
            refund.Status = "Requesting";
            refund.UpdatedAt = DateTime.UtcNow.AddMinutes(-16); // past the worker's 15 minute window
            await _context.SaveChangesAsync();
            return Ok(new { status = refund.Status });
        }

        // ---------------- Revenue ----------------

        [HttpGet("revenue")]
        public async Task<IActionResult> GetRevenue([FromQuery] int months = 12)
        {
            if (!await IsAdminAsync()) return AccessDenied();
            months = months < 1 ? 1 : months > 36 ? 36 : months;

            var now = DateTime.UtcNow;
            var firstMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(-(months - 1));

            var rows = await _context.Bookings
                .Where(b => (b.Status == "paid" || b.Status == "confirmed" || b.Status == "completed") && b.CreatedAt >= firstMonth)
                .Select(b => new { b.CreatedAt, b.ServiceFee, b.PromoDiscount, b.CreditApplied })
                .ToListAsync();

            var result = new List<object>();
            decimal totalFees = 0;
            for (var i = 0; i < months; i++)
            {
                var m = firstMonth.AddMonths(months - 1 - i); // newest first
                var inMonth = rows.Where(r => r.CreatedAt.Year == m.Year && r.CreatedAt.Month == m.Month).ToList();
                var fees = inMonth.Sum(r => r.ServiceFee);
                var discounts = inMonth.Sum(r => r.PromoDiscount + r.CreditApplied);
                totalFees += fees;
                result.Add(new
                {
                    month = m.ToString("yyyy-MM"),
                    paidBookings = inMonth.Count,
                    platformFees = fees,
                    discounts,
                    netPlatformRevenue = fees - discounts
                });
            }

            return Ok(new { months = result, totalPlatformFees = totalFees });
        }

        // ---------------- Promo codes ----------------

        [HttpGet("promo-codes")]
        public async Task<IActionResult> GetPromoCodes()
        {
            if (!await IsAdminAsync()) return AccessDenied();

            var usage = await _context.Bookings
                .Where(b => b.PromoCodeId != null)
                .BlockingDates(_context, DateTime.UtcNow)
                .GroupBy(b => b.PromoCodeId!.Value)
                .Select(g => new { id = g.Key, count = g.Count() })
                .ToDictionaryAsync(x => x.id, x => x.count);

            var codes = await _context.PromoCodes.OrderByDescending(p => p.CreatedAt).ToListAsync();
            return Ok(codes.Select(p => PromoDto(p, usage.GetValueOrDefault(p.Id))));
        }

        private static object PromoDto(PromoCode p, int timesUsed) => new
        {
            id = p.Id,
            code = p.Code,
            discountType = p.DiscountType,
            discountValue = p.DiscountValue,
            expiresAt = p.ExpiresAt,
            usageLimit = p.UsageLimit,
            timesUsed,
            isActive = p.IsActive,
            createdAt = p.CreatedAt
        };

        [HttpPost("promo-codes")]
        public async Task<IActionResult> CreatePromoCode([FromBody] CreatePromoCodeRequest req)
        {
            if (!await IsAdminAsync()) return AccessDenied();

            var code = (req.Code ?? string.Empty).Trim().ToUpperInvariant();
            if (code.Length < 3 || code.Length > 32 || !code.All(c => (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-'))
                return BadRequest(new { message = "Code must be 3-32 characters: letters, digits or dashes." });

            var type = (req.DiscountType ?? string.Empty).Trim().ToLowerInvariant();
            if (type == "percent")
            {
                if (req.DiscountValue < 1 || req.DiscountValue > 100)
                    return BadRequest(new { message = "Percent discount must be between 1 and 100." });
            }
            else if (type == "fixed")
            {
                if (req.DiscountValue <= 0) return BadRequest(new { message = "Fixed discount must be greater than 0." });
            }
            else return BadRequest(new { message = "Discount type must be 'percent' or 'fixed'." });

            if (req.ExpiresAt.HasValue && req.ExpiresAt.Value.ToUniversalTime() <= DateTime.UtcNow)
                return BadRequest(new { message = "Expiry must be in the future." });
            if (req.UsageLimit.HasValue && req.UsageLimit.Value <= 0)
                return BadRequest(new { message = "Usage limit must be greater than 0." });

            if (await _context.PromoCodes.AnyAsync(p => p.Code == code))
                return Conflict(new { message = "A promo code with that name already exists." });

            var promo = new PromoCode
            {
                Code = code,
                DiscountType = type,
                DiscountValue = req.DiscountValue,
                ExpiresAt = req.ExpiresAt?.ToUniversalTime(),
                UsageLimit = req.UsageLimit
            };
            _context.PromoCodes.Add(promo);
            await _context.SaveChangesAsync();
            return Ok(PromoDto(promo, 0));
        }

        [HttpPatch("promo-codes/{id}")]
        public async Task<IActionResult> UpdatePromoCode(Guid id, [FromBody] JsonElement body)
        {
            if (!await IsAdminAsync()) return AccessDenied();
            var promo = await _context.PromoCodes.FindAsync(id);
            if (promo == null) return NotFound(new { message = "Promo code not found." });
            if (body.ValueKind != JsonValueKind.Object) return BadRequest(new { message = "Invalid body." });

            foreach (var prop in body.EnumerateObject())
            {
                switch (prop.Name.ToLowerInvariant())
                {
                    case "isactive":
                        if (prop.Value.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
                            return BadRequest(new { message = "isActive must be true or false." });
                        promo.IsActive = prop.Value.GetBoolean();
                        break;
                    case "expiresat":
                        if (prop.Value.ValueKind == JsonValueKind.Null) { promo.ExpiresAt = null; break; }
                        if (prop.Value.ValueKind != JsonValueKind.String || !DateTime.TryParse(prop.Value.GetString(), CultureInfo.InvariantCulture,
                                DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var exp))
                            return BadRequest(new { message = "expiresAt is not a valid date." });
                        if (exp <= DateTime.UtcNow) return BadRequest(new { message = "Expiry must be in the future." });
                        promo.ExpiresAt = exp;
                        break;
                    case "usagelimit":
                        if (prop.Value.ValueKind == JsonValueKind.Null) { promo.UsageLimit = null; break; }
                        if (prop.Value.ValueKind != JsonValueKind.Number || !prop.Value.TryGetInt32(out var limit) || limit <= 0)
                            return BadRequest(new { message = "Usage limit must be greater than 0." });
                        promo.UsageLimit = limit;
                        break;
                }
            }

            await _context.SaveChangesAsync();
            var used = await _context.Bookings.Where(b => b.PromoCodeId == promo.Id).BlockingDates(_context, DateTime.UtcNow).CountAsync();
            return Ok(PromoDto(promo, used));
        }
    }
}
