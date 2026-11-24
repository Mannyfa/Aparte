// Backend/Shortlet.Core/Interfaces/IEmailService.cs
namespace Shortlet.Core.Interfaces
{
    public interface IEmailService
    {
        /// <summary>True when SMTP settings are present. When false, emails are logged instead of sent.</summary>
        bool IsConfigured { get; }

        Task SendEmailAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken = default);
    }
}
