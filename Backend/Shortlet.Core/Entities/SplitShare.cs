using System;

namespace Shortlet.Core.Entities
{
    public class SplitShare
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        
        public Guid SplitGroupId { get; set; }
        public SplitGroup SplitGroup { get; set; }
        
        public decimal Amount { get; set; }
        public string Status { get; set; } = "Pending"; 
        
        
        public string PaymentReference { get; set; } = Guid.NewGuid().ToString(); 
    }
}