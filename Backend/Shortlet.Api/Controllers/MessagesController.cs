// Backend/Shortlet.Api/Controllers/MessagesController.cs
using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Shortlet.Api.Hubs;
using Shortlet.Core.Entities;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Controllers
{
    public class SendMessageDto
    {
        public Guid ReceiverId { get; set; }
        public string Content { get; set; }
    }

    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class MessagesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IHubContext<ChatHub> _hubContext;

        public MessagesController(AppDbContext context, IHubContext<ChatHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }

        // --- NEW: FETCH REAL USERS FOR THE SIDEBAR ---
        [HttpGet("contacts")]
        public async Task<IActionResult> GetContacts()
        {
            var myId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier).Value);

            // Fetches all other users in the system so you have real people to chat with!
            var contacts = await _context.Users
                .Where(u => u.Id != myId)
                .Select(u => new { 
                    id = u.Id, 
                    name = u.Name 
                })
                .ToListAsync();

            return Ok(contacts);
        }

        // --- NEW: FETCH CHAT HISTORY ---
        [HttpGet("{otherUserId}")]
        public async Task<IActionResult> GetConversation(Guid otherUserId)
        {
            var myId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier).Value);

            var messages = await _context.Messages
                .Where(m => (m.SenderId == myId && m.ReceiverId == otherUserId) || 
                            (m.SenderId == otherUserId && m.ReceiverId == myId))
                .OrderBy(m => m.Timestamp)
                .Select(m => new {
                    m.Id,
                    m.Content,
                    m.Timestamp,
                    IsMine = m.SenderId == myId
                })
                .ToListAsync();

            return Ok(messages);
        }

        [HttpPost]
        public async Task<IActionResult> SendMessage([FromBody] SendMessageDto request)
        {
            var myId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier).Value);

            var message = new Message
            {
                SenderId = myId,
                ReceiverId = request.ReceiverId,
                Content = request.Content
            };

            _context.Messages.Add(message);
            await _context.SaveChangesAsync();

            // Beam it instantly to the other person!
            await _hubContext.Clients.Group(request.ReceiverId.ToString())
                .SendAsync("ReceiveMessage", new {
                    id = message.Id,
                    content = message.Content,
                    timestamp = message.Timestamp,
                    isMine = false // To the receiver, it's incoming
                });

            return Ok(new { id = message.Id, content = message.Content, timestamp = message.Timestamp, isMine = true });
        }
    }
}