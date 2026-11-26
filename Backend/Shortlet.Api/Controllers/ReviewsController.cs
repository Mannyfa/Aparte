// Backend/Shortlet.Api/Controllers/ReviewsController.cs
using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shortlet.Core.Entities;
using Shortlet.Api.Helpers;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Controllers
{
    public class CreateReviewDto
    {
        public Guid PropertyId { get; set; }
        public int Rating { get; set; }
        public string? Comment { get; set; }
    }

    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ReviewsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ReviewsController(AppDbContext context)
        {
            _context = context;
        }

        // 1. GET: HOST DASHBOARD REVIEWS
        [HttpGet("host")]
        public async Task<IActionResult> GetHostReviews()
        {
            try
            {
                var hostId = (User.GetUserId() ?? throw new UnauthorizedAccessException());

                var reviews = await _context.Reviews
                    .Include(r => r.Property)
                    .Include(r => r.Guest)
                    .Where(r => r.Property.HostId == hostId)
                    .OrderByDescending(r => r.CreatedAt)
                    .Select(r => new {
                        r.Id,
                        r.Rating,
                        r.Comment,
                        r.CreatedAt,
                        PropertyTitle = r.Property.Title,
                        GuestName = r.Guest.Name
                    })
                    .ToListAsync();

                // Calculate the Host's overall rating automatically
                var totalReviews = reviews.Count;
                var averageRating = totalReviews > 0 ? Math.Round(reviews.Average(r => r.Rating), 1) : 0;

                return Ok(new {
                    stats = new { totalReviews, averageRating },
                    reviews
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        // PUBLIC: reviews shown on a listing (first name + initial only)
        [HttpGet("property/{propertyId:guid}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetPropertyReviews(Guid propertyId, [FromQuery] int take = 20)
        {
            take = Math.Clamp(take, 1, 50);
            var rows = await _context.Reviews
                .Where(r => r.PropertyId == propertyId)
                .OrderByDescending(r => r.CreatedAt)
                .Take(take)
                .Select(r => new { r.Id, r.Rating, r.Comment, r.CreatedAt, GuestName = r.Guest.Name })
                .ToListAsync();

            var stats = await _context.Reviews.Where(r => r.PropertyId == propertyId)
                .GroupBy(_ => 1)
                .Select(g => new { Count = g.Count(), Average = g.Average(r => r.Rating) })
                .FirstOrDefaultAsync();

            static string ShortName(string name)
            {
                var parts = (name ?? "").Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
                return parts.Length switch { 0 => "Guest", 1 => parts[0], _ => $"{parts[0]} {parts[^1][0]}." };
            }

            return Ok(new
            {
                count = stats?.Count ?? 0,
                average = stats == null ? (double?)null : Math.Round(stats.Average, 1),
                reviews = rows.Select(r => new { r.Id, r.Rating, r.Comment, r.CreatedAt, guestName = ShortName(r.GuestName) })
            });
        }

        // 2. POST: GUEST LEAVES A REVIEW
        [HttpPost]
        public async Task<IActionResult> CreateReview([FromBody] CreateReviewDto request)
        {
            try
            {
                var guestId = (User.GetUserId() ?? throw new UnauthorizedAccessException());

                if (request.Rating < 1 || request.Rating > 5)
                    return BadRequest(new { message = "Rating must be between 1 and 5." });
                request.Comment = request.Comment?.Trim() ?? string.Empty;
                if (request.Comment.Length > 2000)
                    return BadRequest(new { message = "Reviews are limited to 2000 characters." });

                // Security Check: Did this guest actually stay (confirmed booking that has started)?
                var now = DateTime.UtcNow;
                var hasStayed = await _context.Bookings.AnyAsync(b =>
                    b.PropertyId == request.PropertyId &&
                    b.GuestId == guestId &&
                    (b.Status == "confirmed" || b.Status == "completed") &&
                    b.CheckIn <= now);

                if (!hasStayed)
                    return BadRequest(new { message = "You can only review properties you have booked." });

                // Prevent spam: Only 1 review per guest per property
                var alreadyReviewed = await _context.Reviews.AnyAsync(r => 
                    r.PropertyId == request.PropertyId && r.GuestId == guestId);
                
                if (alreadyReviewed)
                    return BadRequest(new { message = "You have already reviewed this property." });

                var review = new Review
                {
                    PropertyId = request.PropertyId,
                    GuestId = guestId,
                    Rating = request.Rating,
                    Comment = request.Comment
                };

                _context.Reviews.Add(review);
                await _context.SaveChangesAsync();
                PropertiesController.InvalidatePublicCache(); // new rating shows on the listing right away

                return Ok(new { message = "Review submitted successfully!" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }
    }
}