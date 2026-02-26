// Backend/Shortlet.Core/Interfaces/IAuthService.cs
using System.Threading.Tasks;
using Shortlet.Core.DTOs;

namespace Shortlet.Core.Interfaces
{
    public interface IAuthService
    {
        Task<AuthResponseDto> RegisterAsync(RegisterDto request);
        Task<AuthResponseDto> LoginAsync(LoginDto request);
    }
}