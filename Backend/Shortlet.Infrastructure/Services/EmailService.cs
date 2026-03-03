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

        // 1. The Generic Email Sender (Does the heavy lifting)
        public async Task SendEmailAsync(string toEmail, string subject, string body)
        {
            var message = new MimeMessage();
            var senderEmail = _config["Email:SenderEmail"];
            
            message.From.Add(new MailboxAddress("Apartey Reservations", senderEmail));
            message.To.Add(new MailboxAddress("", toEmail));
            message.Subject = subject;

            message.Body = new TextPart("html") { Text = body };

            using var client = new SmtpClient();
            try
            {
                await client.ConnectAsync(_config["Email:SmtpServer"], int.Parse(_config["Email:SmtpPort"]), SecureSocketOptions.StartTls);
                await client.AuthenticateAsync(senderEmail, _config["Email:SenderPassword"]);
                await client.SendAsync(message);
                await client.DisconnectAsync(true);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[EMAIL ERROR]: {ex.Message}");
                throw;
            }
        }

        // 2. The Missing Interface Method (Satisfies the compiler)
        public async Task SendBookingConfirmationAsync(string toEmail, string guestName, string propertyTitle, string checkInCode)
        {
            var subject = "Apartey: Booking Confirmed!";
            var body = $@"
                <h1>Your Booking is Confirmed!</h1>
                <p>Hi {guestName},</p>
                <p>Get ready for luxury. Your host has approved your stay at <strong>{propertyTitle}</strong>.</p>
                <div style='padding: 20px; background: #f4f4f4; border-radius: 8px; margin: 20px 0;'>
                    <h2 style='margin: 0; color: #1a1a1a;'>Check-In Code: {checkInCode}</h2>
                </div>
                <p>Show this code to security upon arrival.</p>
            ";

            // Calls our heavy lifter from above!
            await SendEmailAsync(toEmail, subject, body);
        }
    }
}