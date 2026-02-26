// Backend/Shortlet.Core/Interfaces/IPropertyService.cs
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Shortlet.Core.DTOs;
using Shortlet.Core.Entities;

namespace Shortlet.Core.Interfaces
{
    public interface IPropertyService
    {
        Task<Property> CreatePropertyAsync(Guid hostId, CreatePropertyDto request);
        Task<IEnumerable<Property>> GetAllActivePropertiesAsync();
    }
}