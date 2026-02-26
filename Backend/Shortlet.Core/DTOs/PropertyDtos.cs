// Backend/Shortlet.Core/DTOs/PropertyDtos.cs
using System.Collections.Generic;
using Microsoft.AspNetCore.Http;

namespace Shortlet.Core.DTOs
{
    public class CreatePropertyDto
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public decimal PricePerNight { get; set; }
        public string State { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string Area { get; set; } = string.Empty;
        public string AmenitiesJson { get; set; } = "[]";
        
        // This accepts files directly from the frontend form
        public List<IFormFile> Images { get; set; } = new List<IFormFile>();
    }
}