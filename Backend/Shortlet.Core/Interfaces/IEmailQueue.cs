// Backend/Shortlet.Core/Interfaces/IEmailQueue.cs
using System.Threading;
using System.Threading.Tasks;

namespace Shortlet.Core.Interfaces
{
    public class EmailMessagePayload
    {
        public string ToEmail { get; set; }
        public string Subject { get; set; }
        public string Body { get; set; }
    }

    public interface IEmailQueue
    {
        ValueTask QueueEmailAsync(EmailMessagePayload payload);
        Task<EmailMessagePayload> DequeueEmailAsync(CancellationToken cancellationToken);
    }
}