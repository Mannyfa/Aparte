// Backend/Shortlet.Api/Controllers/ReviewsController.cs
using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shortlet.Core.Entities;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Controllers
{
    public class CreateReviewDto
    {
        public Guid PropertyId { get; set; }
        public int Rating { get; set; }
        public string Comment { get; set; }
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
                var hostId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier).Value);

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

        // 2. POST: GUEST LEAVES A REVIEW
        [HttpPost]
        public async Task<IActionResult> CreateReview([FromBody] CreateReviewDto request)
        {
            try
            {
                var guestId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier).Value);

                // Security Check: Did this guest actually book this property?
                var hasStayed = await _context.Bookings.AnyAsync(b => 
                    b.PropertyId == request.PropertyId && 
                    b.GuestId == guestId && 
                    b.Status == "confirmed"); 

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

                return Ok(new { message = "Review submitted successfully!" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }
    }
}