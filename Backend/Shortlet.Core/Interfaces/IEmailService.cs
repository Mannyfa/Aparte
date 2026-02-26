// Backend/Shortlet.Core/Interfaces/IEmailService.cs
using System.Threading.Tasks;

namespace Shortlet.Core.Interfaces
{
    public interface IEmailService
    {
        Task SendBookingConfirmationAsync(string guestEmail, string guestName, string propertyName, string reference);
    }
}