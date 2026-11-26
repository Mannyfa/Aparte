// Backend/Shortlet.Api/Controllers/MessagesController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Shortlet.Api.Helpers;
using Shortlet.Api.Hubs;
using Shortlet.Core.Entities;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Api.Controllers
{
    public class SendMessageDto
    {
        public Guid ReceiverId { get; set; }
        public string Content { get; set; } = string.Empty;
    }

    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class MessagesController : ControllerBase
    {
        private const int MaxMessageLength = 2000;

        private readonly AppDbContext _context;
        private readonly IHubContext<ChatHub> _hubContext;
        private readonly Shortlet.Api.Services.Notifier _notifier;

        public MessagesController(AppDbContext context, IHubContext<ChatHub> hubContext, Shortlet.Api.Services.Notifier notifier)
        {
            _context = context;
            _hubContext = hubContext;
            _notifier = notifier;
        }

        /// <summary>
        /// People I'm allowed to talk to: the hosts of places I've booked, the guests who've booked my places,
        /// and anyone who already has a conversation with me. (Previously this returned every user.)
        /// </summary>
        private IQueryable<Guid> ContactIds(Guid myId)
        {
            var myHosts = _context.Bookings.Where(b => b.GuestId == myId).Select(b => b.Property.HostId);
            var myGuests = _context.Bookings.Where(b => b.Property.HostId == myId).Select(b => b.GuestId);
            var talkedTo = _context.Messages.Where(m => m.SenderId == myId).Select(m => m.ReceiverId)
                .Union(_context.Messages.Where(m => m.ReceiverId == myId).Select(m => m.SenderId));
            return myHosts.Union(myGuests).Union(talkedTo);
        }

        [HttpGet("contacts")]
        public async Task<IActionResult> GetContacts()
        {
            var myId = User.GetUserId();
            if (myId == null) return Unauthorized();

            var ids = ContactIds(myId.Value);
            var contacts = await _context.Users
                .Where(u => u.Id != myId.Value && ids.Contains(u.Id))
                .Select(u => new { id = u.Id, name = u.Name })
                .ToListAsync();

            return Ok(contacts);
        }

        [HttpGet("{otherUserId:guid}")]
        public async Task<IActionResult> GetConversation(Guid otherUserId)
        {
            var myId = User.GetUserId();
            if (myId == null) return Unauthorized();

            var messages = await _context.Messages
                .Where(m => (m.SenderId == myId.Value && m.ReceiverId == otherUserId) ||
                            (m.SenderId == otherUserId && m.ReceiverId == myId.Value))
                .OrderBy(m => m.Timestamp)
                .Select(m => new { m.Id, m.Content, m.Timestamp, IsMine = m.SenderId == myId.Value })
                .ToListAsync();

            return Ok(messages);
        }

        [HttpPost]
        public async Task<IActionResult> SendMessage([FromBody] SendMessageDto request)
        {
            var myId = User.GetUserId();
            if (myId == null) return Unauthorized();

            var content = request.Content?.Trim() ?? string.Empty;
            if (content.Length == 0) return BadRequest(new { message = "Message can't be empty." });
            if (content.Length > MaxMessageLength) return BadRequest(new { message = $"Messages are limited to {MaxMessageLength} characters." });
            if (request.ReceiverId == myId.Value) return BadRequest(new { message = "You can't message yourself." });

            var allowed = await ContactIds(myId.Value).AnyAsync(id => id == request.ReceiverId);
            if (!allowed) return StatusCode(403, new { message = "You can only message your hosts or guests." });

            var message = new Message { SenderId = myId.Value, ReceiverId = request.ReceiverId, Content = content };
            _context.Messages.Add(message);
            await _context.SaveChangesAsync();

            await _hubContext.Clients.Group(request.ReceiverId.ToString()).SendAsync("ReceiveMessage", new
            {
                id = message.Id,
                senderId = myId.Value,
                content = message.Content,
                timestamp = message.Timestamp,
                isMine = false
            });

            // Push to the receiver's devices too (the live event above covers open tabs).
            var senderName = await _context.Users.Where(u => u.Id == myId.Value).Select(u => u.Name).FirstOrDefaultAsync() ?? "Someone";
            await _notifier.NotifyAsync(request.ReceiverId, $"Message from {senderName}",
                content.Length > 140 ? content[..140] + "…" : content, "/", "ReceiveMessage", live: false);

            return Ok(new { id = message.Id, content = message.Content, timestamp = message.Timestamp, isMine = true });
        }
    }
}
