using System.Security.Claims;

namespace Shortlet.Api.Helpers
{
    public static class UserExtensions
    {
        /// <summary>The logged-in user's id, or null if the token has no usable id claim.</summary>
        public static Guid? GetUserId(this ClaimsPrincipal user)
        {
            var value = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value;
            return Guid.TryParse(value, out var id) ? id : null;
        }

        /// <summary>Case-insensitive role check (older tokens carry "Host"/"Guest", new ones lower-case).</summary>
        public static bool HasRole(this ClaimsPrincipal user, string role) =>
            user.FindAll(ClaimTypes.Role).Any(c => string.Equals(c.Value, role, StringComparison.OrdinalIgnoreCase));
    }
}
