// Backend/Shortlet.Core/Interfaces/IPaystackService.cs
using System.Threading.Tasks;

namespace Shortlet.Core.Interfaces
{
    public interface IPaystackService
    {
        Task<string> InitializePaymentAsync(decimal amount, string reference, string email);
    }
}