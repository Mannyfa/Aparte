// Backend/Shortlet.Api/Controllers/BookingsController.cs
using System;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shortlet.Core.DTOs;
using Shortlet.Core.Interfaces;

namespace Shortlet.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize] // MUST be logged in to book
    public class BookingsController : ControllerBase
    {
        private readonly IBookingService _bookingService;

        public BookingsController(IBookingService bookingService)
        {
            _bookingService = bookingService;
        }

        [HttpPost]
        public async Task<IActionResult> CreateBooking([FromBody] CreateBookingDto request)
        {
            try 
            {
                var guestId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                var guestEmail = User.FindFirst(ClaimTypes.Email)!.Value;
                
                var result = await _bookingService.CreatePendingBookingAsync(guestId, guestEmail, request);
                return Ok(result); 
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}