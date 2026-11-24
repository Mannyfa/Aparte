// Backend/Shortlet.Infrastructure/Services/EmailBackgroundWorker.cs
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Shortlet.Core.Interfaces;

namespace Shortlet.Infrastructure.Services
{
    /// <summary>
    /// Sends queued emails in the background so API requests and webhooks return immediately.
    /// (Previously this only logged "SUCCESS" without sending anything.)
    /// </summary>
    public class EmailBackgroundWorker : BackgroundService
    {
        private const int MaxAttempts = 3;

        private readonly IEmailQueue _emailQueue;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<EmailBackgroundWorker> _logger;

        public EmailBackgroundWorker(IEmailQueue emailQueue, IServiceScopeFactory scopeFactory, ILogger<EmailBackgroundWorker> logger)
        {
            _emailQueue = emailQueue;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Background email worker started.");

            while (!stoppingToken.IsCancellationRequested)
            {
                EmailMessagePayload payload;
                try
                {
                    payload = await _emailQueue.DequeueEmailAsync(stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }

                using var scope = _scopeFactory.CreateScope();
                var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();

                if (!emailService.IsConfigured)
                {
                    _logger.LogWarning("SMTP not configured; email to {To} ('{Subject}') was not sent.", payload.ToEmail, payload.Subject);
                    continue;
                }

                for (var attempt = 1; attempt <= MaxAttempts; attempt++)
                {
                    try
                    {
                        await emailService.SendEmailAsync(payload.ToEmail, payload.Subject, payload.Body, stoppingToken);
                        _logger.LogInformation("Email sent to {To}: {Subject}", payload.ToEmail, payload.Subject);
                        break;
                    }
                    catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                    {
                        return;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Sending email to {To} failed (attempt {Attempt}/{Max}).", payload.ToEmail, attempt, MaxAttempts);
                        if (attempt < MaxAttempts) await Task.Delay(TimeSpan.FromSeconds(5 * attempt), stoppingToken);
                    }
                }
            }

            _logger.LogInformation("Background email worker stopped.");
        }
    }
}
