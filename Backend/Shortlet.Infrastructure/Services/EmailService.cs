// Backend/Shortlet.Infrastructure/Services/EmailService.cs
using System.Net;
using System.Net.Mail;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Shortlet.Core.Interfaces;

namespace Shortlet.Infrastructure.Services
{
    public class EmailService : IEmailService
    {
        private readonly string _smtpServer;
        private readonly int _smtpPort;
        private readonly string _senderEmail;
        private readonly string _senderPassword;

        public EmailService(IConfiguration config)
        {
            _smtpServer = config["Email:SmtpServer"] ?? "smtp.gmail.com";
            _smtpPort = int.Parse(config["Email:SmtpPort"] ?? "587");
            _senderEmail = config["Email:SenderEmail"]!;
            _senderPassword = config["Email:SenderPassword"]!;
        }

        public async Task SendBookingConfirmationAsync(string guestEmail, string guestName, string propertyName, string reference)
        {
            using var client = new SmtpClient(_smtpServer, _smtpPort)
            {
                Credentials = new NetworkCredential(_senderEmail, _senderPassword),
                EnableSsl = true
            };

            var mailMessage = new MailMessage
            {
                From = new MailAddress(_senderEmail, "Nigerian Shortlet"),
                Subject = $"Booking Confirmed: {propertyName}",
                Body = $@"
                    <h2>Payment Successful!</h2>
                    <p>Hi {guestName},</p>
                    <p>Your booking for <strong>{propertyName}</strong> has been confirmed.</p>
                    <p><strong>Booking Reference:</strong> {reference}</p>
                    <br/>
                    <p>Thank you for choosing Nigerian Shortlet. Safe travels!</p>
                ",
                IsBodyHtml = true
            };

            mailMessage.To.Add(guestEmail);
            await client.SendMailAsync(mailMessage);
        }
    }
}