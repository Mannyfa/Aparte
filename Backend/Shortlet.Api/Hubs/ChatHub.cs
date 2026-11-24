// Backend/Shortlet.Api/Hubs/ChatHub.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Shortlet.Api.Hubs
{
    /// <summary>
    /// Each authenticated connection is put in a group named after its own user id, taken from the JWT.
    /// Clients can no longer choose which room to join, so nobody can listen in on another user's messages.
    /// Server code sends with Clients.Group(userId.ToString()).
    /// </summary>
    [Authorize]
    public class ChatHub : Hub
    {
        public override async Task OnConnectedAsync()
        {
            if (!string.IsNullOrEmpty(Context.UserIdentifier))
                await Groups.AddToGroupAsync(Context.ConnectionId, Context.UserIdentifier);

            await base.OnConnectedAsync();
        }
    }
}
