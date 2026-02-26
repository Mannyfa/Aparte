// Backend/Shortlet.Core/Interfaces/Repositories/IPropertyRepository.cs
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Shortlet.Core.Entities;

namespace Shortlet.Core.Interfaces.Repositories
{
    public interface IPropertyRepository
    {
        Task<Property> AddAsync(Property property);
        Task<IEnumerable<Property>> GetAllActiveAsync();
        Task<Property?> GetByIdAsync(Guid id);
        Task SaveChangesAsync();
    }
}