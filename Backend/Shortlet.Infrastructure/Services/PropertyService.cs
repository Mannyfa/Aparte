// Backend/Shortlet.Infrastructure/Services/PropertyService.cs
using System;
using System.Threading.Tasks;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.Extensions.Configuration;
using Shortlet.Core.DTOs;
using Shortlet.Core.Entities;
using Shortlet.Core.Interfaces;
using Shortlet.Core.Interfaces.Repositories;

namespace Shortlet.Infrastructure.Services
{
    public class PropertyService : IPropertyService
    {
        private readonly IPropertyRepository _propertyRepository;
        private readonly Cloudinary _cloudinary;

        public PropertyService(IPropertyRepository propertyRepository, IConfiguration config)
        {
            _propertyRepository = propertyRepository;
            
            var account = new Account(
                config["Cloudinary:CloudName"],
                config["Cloudinary:ApiKey"],
                config["Cloudinary:ApiSecret"]
            );
            _cloudinary = new Cloudinary(account);
        }

        public async Task<Property> CreatePropertyAsync(Guid hostId, CreatePropertyDto request)
        {
            var property = new Property
            {
                HostId = hostId,
                Title = request.Title,
                Description = request.Description,
                Type = request.Type,
                PricePerNight = request.PricePerNight,
                State = request.State,
                City = request.City,
                Area = request.Area,
                AmenitiesJson = request.AmenitiesJson,
                Status = "active" // Defaulting to active for testing; normally "pending_approval"
            };

            // Process Image Uploads
            int order = 1;
            foreach (var file in request.Images)
            {
                if (file.Length > 0)
                {
                    using var stream = file.OpenReadStream();
                    var uploadParams = new ImageUploadParams
                    {
                        File = new FileDescription(file.FileName, stream),
                        Folder = "shortlet_properties"
                    };

                    var uploadResult = await _cloudinary.UploadAsync(uploadParams);

                    if (uploadResult.Error == null)
                    {
                        property.Images.Add(new PropertyImage
                        {
                            Url = uploadResult.SecureUrl.ToString(),
                            Order = order++
                        });
                    }
                }
            }

            await _propertyRepository.AddAsync(property);
            await _propertyRepository.SaveChangesAsync();

            return property;
        }

        public async Task<IEnumerable<Property>> GetAllActivePropertiesAsync()
        {
            return await _propertyRepository.GetAllActiveAsync();
        }
    }
}