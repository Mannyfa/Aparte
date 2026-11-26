// Backend/Shortlet.Core/Interfaces/IPaystackService.cs
namespace Shortlet.Core.Interfaces
{
    /// <summary>Result of a Paystack call: Ok plus Paystack's message (useful in logs and UI errors).</summary>
    public record PaystackResult(bool Ok, string Message);

    public record PaystackBank(string Name, string Code);

    /// <summary>Transfer state as Paystack reports it: success, pending, otp, failed, reversed, abandoned…</summary>
    public record PaystackTransferStatus(bool Found, string Status, string Message);

    public interface IPaystackService
    {
        /// <summary>Starts a checkout and returns Paystack's authorization URL. Throws on failure.</summary>
        Task<string> InitializePaymentAsync(decimal amount, string reference, string email, string callbackUrl);

        /// <summary>
        /// Refunds a transaction. Pass <paramref name="amount"/> for a partial refund (e.g. returning only the
        /// caution fee); null refunds the whole transaction. Paystack processes refunds asynchronously.
        /// </summary>
        Task<PaystackResult> RefundAsync(string transactionReference, decimal? amount = null, string? note = null);

        /// <summary>Nigerian banks that support transfers (name + bank code).</summary>
        Task<IReadOnlyList<PaystackBank>> ListBanksAsync();

        /// <summary>Looks up the account holder's name. Returns null if the account doesn't exist.</summary>
        Task<string?> ResolveAccountNameAsync(string accountNumber, string bankCode);

        /// <summary>Creates a NUBAN transfer recipient and returns its recipient code.</summary>
        Task<(bool Ok, string? RecipientCode, string Message)> CreateRecipientAsync(string accountName, string accountNumber, string bankCode);

        /// <summary>Starts a transfer from the Paystack balance. Returns Paystack's initial transfer status.</summary>
        Task<(bool Ok, string Status, string Message)> InitiateTransferAsync(decimal amount, string recipientCode, string reference, string reason);

        /// <summary>Asks Paystack for the current status of a transfer by our reference.</summary>
        Task<PaystackTransferStatus> VerifyTransferAsync(string reference);
    }
}
