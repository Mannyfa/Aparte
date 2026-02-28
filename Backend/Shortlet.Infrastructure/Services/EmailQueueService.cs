// Backend/Shortlet.Infrastructure/Services/EmailQueueService.cs
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;
using Shortlet.Core.Interfaces;

namespace Shortlet.Infrastructure.Services
{
    public class EmailQueueService : IEmailQueue
    {
        private readonly Channel<EmailMessagePayload> _queue;

        public EmailQueueService()
        {
            // Creates an unbounded queue (can hold unlimited pending emails)
            var options = new UnboundedChannelOptions { SingleReader = true };
            _queue = Channel.CreateUnbounded<EmailMessagePayload>(options);
        }

        public async ValueTask QueueEmailAsync(EmailMessagePayload payload)
        {
            await _queue.Writer.WriteAsync(payload);
        }

        public async Task<EmailMessagePayload> DequeueEmailAsync(CancellationToken cancellationToken)
        {
            return await _queue.Reader.ReadAsync(cancellationToken);
        }
    }
}