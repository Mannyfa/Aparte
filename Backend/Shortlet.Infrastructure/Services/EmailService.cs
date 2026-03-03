using System;
using System.Threading.Tasks;
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

        public async Task SendEmailAsync(string toEmail, string subject, string body)
        {
            var message = new MimeMessage();
            
            // Grabbing your specific Gmail settings
            var senderEmail = _config["Email:SenderEmail"];
            
            // Setting the "From" name to your brand!
            message.From.Add(new MailboxAddress("Apartey Reservations", senderEmail));
            message.To.Add(new MailboxAddress("", toEmail));
            
            message.Subject = subject;

            // Sending as HTML so you can make beautiful email templates later
            message.Body = new TextPart("html")
            {
                Text = body
            };

            using var client = new SmtpClient();
            try
            {
                // Connect to Google's SMTP Server
                await client.ConnectAsync(
                    _config["Email:SmtpServer"], 
                    int.Parse(_config["Email:SmtpPort"]), 
                    SecureSocketOptions.StartTls
                );
                
                // Login using your App Password
                await client.AuthenticateAsync(
                    senderEmail, 
                    _config["Email:SenderPassword"]
                );

                await client.SendAsync(message);
                await client.DisconnectAsync(true);
            }
            catch (Exception ex)
            {
                // Logs the exact reason if Gmail ever blocks a connection
                Console.WriteLine($"[EMAIL ERROR]: {ex.Message}");
                throw; // Optional: Remove 'throw' if you don't want email failures to crash the booking process
            }
        }
    }
}