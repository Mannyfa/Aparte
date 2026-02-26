// Backend/Shortlet.Infrastructure/Repositories/PropertyRepository.cs
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Shortlet.Core.Entities;
using Shortlet.Core.Interfaces.Repositories;
using Shortlet.Infrastructure.Data;

namespace Shortlet.Infrastructure.Repositories
{
    public class PropertyRepository : IPropertyRepository
    {
        private readonly AppDbContext _context;

        public PropertyRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<Property> AddAsync(Property property)
        {
            await _context.Properties.AddAsync(property);
            return property;
        }

        public async Task<IEnumerable<Property>> GetAllActiveAsync()
        {
            return await _context.Properties
                .Include(p => p.Images)
                .Where(p => p.Status == "active")
                .ToListAsync();
        }

        public async Task<Property?> GetByIdAsync(Guid id)
        {
            return await _context.Properties
                .Include(p => p.Images)
                .Include(p => p.Host)
                .FirstOrDefaultAsync(p => p.Id == id);
        }

        public async Task SaveChangesAsync()
        {
            await _context.SaveChangesAsync();
        }
    }
}