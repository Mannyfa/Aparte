// Backend/Shortlet.Core/Interfaces/IPaystackService.cs
namespace Shortlet.Core.Interfaces
{
    public interface IPaystackService
    {
        /// <summary>Starts a checkout and returns Paystack's authorization URL. Throws on failure.</summary>
        Task<string> InitializePaymentAsync(decimal amount, string reference, string email, string callbackUrl);

        /// <summary>Requests a full refund of a transaction. Returns false (with Paystack's message) on failure.</summary>
        Task<(bool Success, string Message)> RefundAsync(string transactionReference);
    }
}
