// Backend/Shortlet.Infrastructure/Services/EmailService.cs
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using MimeKit;
using Shortlet.Core.Interfaces;

namespace Shortlet.Infrastructure.Services
{
    public class EmailService : IEmailService
    {
        private readonly IConfiguration _config;

        public EmailService(IConfiguration config)
        {
            _config = config;
        }

        public bool IsConfigured =>
            !string.IsNullOrEmpty(_config["Email:SmtpServer"]) &&
            !string.IsNullOrEmpty(_config["Email:SenderEmail"]) &&
            !string.IsNullOrEmpty(_config["Email:SenderPassword"]);

        public async Task SendEmailAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken = default)
        {
            if (!IsConfigured) throw new InvalidOperationException("Email (SMTP) settings are not configured.");

            var senderEmail = _config["Email:SenderEmail"]!;
            var port = int.TryParse(_config["Email:SmtpPort"], out var p) ? p : 587;

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress("Apartey Reservations", senderEmail));
            message.To.Add(MailboxAddress.Parse(toEmail));
            message.Subject = subject;
            message.Body = new TextPart("html") { Text = htmlBody };

            using var client = new SmtpClient();
            await client.ConnectAsync(_config["Email:SmtpServer"]!, port,
                port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls, cancellationToken);
            await client.AuthenticateAsync(senderEmail, _config["Email:SenderPassword"]!, cancellationToken);
            await client.SendAsync(message, cancellationToken);
            await client.DisconnectAsync(true, cancellationToken);
        }
    }
}
