// Backend/Shortlet.Infrastructure/Services/EmailBackgroundWorker.cs
using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Shortlet.Core.Interfaces;

namespace Shortlet.Infrastructure.Services
{
    public class EmailBackgroundWorker : BackgroundService
    {
        private readonly IEmailQueue _emailQueue;
        private readonly ILogger<EmailBackgroundWorker> _logger;

        public EmailBackgroundWorker(IEmailQueue emailQueue, ILogger<EmailBackgroundWorker> logger)
        {
            _emailQueue = emailQueue;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("🟢 Background Email Worker is starting.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    // This waits quietly until an email is dropped into the queue
                    var emailPayload = await _emailQueue.DequeueEmailAsync(stoppingToken);

                    _logger.LogInformation($"📧 Preparing to send email to {emailPayload.ToEmail}...");

                    // Simulated 2-second delay
                    await Task.Delay(2000, stoppingToken); 

                    _logger.LogInformation($"✅ SUCCESS: Email sent to {emailPayload.ToEmail}! Subject: {emailPayload.Subject}");
                }
                catch (OperationCanceledException)
                {
                    // Catch the expected shutdown signal and exit peacefully!
                    _logger.LogInformation("🛑 Background Email Worker is shutting down gracefully.");
                    break; 
                }
                catch (Exception ex)
                {
                    // Only log ACTUAL unexpected errors
                    _logger.LogError(ex, "🔴 Error occurred executing the email background task.");
                }
            }
        }
    }
}