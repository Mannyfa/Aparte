// Backend/Shortlet.Infrastructure/Data/AppDbContext.cs
using Microsoft.EntityFrameworkCore;
using Shortlet.Core.Entities;

namespace Shortlet.Infrastructure.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }
        public DbSet<Property> Properties { get; set; }
        public DbSet<PropertyImage> PropertyImages { get; set; }
        public DbSet<AvailabilityDate> AvailabilityDates { get; set; }
        public DbSet<Booking> Bookings { get; set; }
        public DbSet<Review> Reviews { get; set; }
        public DbSet<Conversation> Conversations { get; set; }
        public DbSet<Message> Messages { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // 1. Concurrency Token: Map Version to PostgreSQL's hidden xmin column
            // This is MANDATORY to prevent double bookings. If two users try to book 
            // the exact same date simultaneously, the second transaction will fail.
            modelBuilder.Entity<AvailabilityDate>()
                .Property(a => a.Version)
                .IsRowVersion();

            // 2. Indexes for Performance
            // A property shouldn't have duplicate availability records for the same day
            modelBuilder.Entity<AvailabilityDate>()
                .HasIndex(a => new { a.PropertyId, a.Date })
                .IsUnique();

            // Fast lookup for webhooks verifying payments
            modelBuilder.Entity<Booking>()
                .HasIndex(b => b.PaymentReference)
                .IsUnique();

            // 3. Foreign Key Constraints & Relationships
            // Ensure when a Property is deleted, its images and dates are deleted (Cascade)
            modelBuilder.Entity<Property>()
                .HasMany(p => p.Images)
                .WithOne()
                .HasForeignKey(i => i.PropertyId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Booking>()
                .HasOne(b => b.Property)
                .WithMany()
                .HasForeignKey(b => b.PropertyId)
                .OnDelete(DeleteBehavior.Restrict); // Prevent deleting properties that have bookings

            modelBuilder.Entity<Booking>()
                .HasOne(b => b.Guest)
                .WithMany()
                .HasForeignKey(b => b.GuestId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}