// Backend/Shortlet.Api/Hubs/ChatHub.cs
using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;

namespace Shortlet.Api.Hubs
{
    public class ChatHub : Hub
    {
        // When a user logs into the React app, they join a secure private room using their User ID
        public async Task JoinPrivateRoom(string userId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, userId);
        }
    }
}