// Backend/Shortlet.Core/Entities/PropertyImage.cs
using System;

namespace Shortlet.Core.Entities
{
    public class PropertyImage
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid PropertyId { get; set; }
        public string Url { get; set; } = string.Empty;
        public int Order { get; set; }
    }
}