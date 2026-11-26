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
        public DbSet<Wallet> Wallets { get; set; }
        public DbSet<Transaction> Transactions { get; set; }
        public DbSet<PropertyCalendar> PropertyCalendars { get; set; }
        public DbSet<PropertyAddOn> PropertyAddOns { get; set; }
        public DbSet<BookingAddOn> BookingAddOns { get; set; }
        public DbSet<SplitGroup> SplitGroups { get; set; }
        public DbSet<SplitShare> SplitShares { get; set; }
        public DbSet<Refund> Refunds { get; set; }
        public DbSet<CalendarFeed> CalendarFeeds { get; set; }
        public DbSet<UserToken> UserTokens { get; set; }
        public DbSet<PushSubscription> PushSubscriptions { get; set; }



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

            // Calendar blocks (host blocks, imported feeds) are looked up per property by date.
            modelBuilder.Entity<PropertyCalendar>().Property(c => c.Source).HasDefaultValue("booking");
            modelBuilder.Entity<PropertyCalendar>().HasIndex(c => new { c.PropertyId, c.EndDate });
            modelBuilder.Entity<PropertyCalendar>().HasIndex(c => c.FeedId);
            modelBuilder.Entity<CalendarFeed>().HasIndex(f => f.PropertyId);
            modelBuilder.Entity<Property>().HasIndex(p => p.CalendarToken).IsUnique();

            modelBuilder.Entity<UserToken>().HasIndex(t => t.TokenHash).IsUnique();
            modelBuilder.Entity<UserToken>().HasIndex(t => new { t.UserId, t.Purpose });

            modelBuilder.Entity<PushSubscription>().HasIndex(s => s.Endpoint).IsUnique();
            modelBuilder.Entity<PushSubscription>().HasIndex(s => s.UserId);

            // Listings are shown newest first; booked dates are looked up per property by check-out date.
            modelBuilder.Entity<Property>().HasIndex(p => p.CreatedAt);
            modelBuilder.Entity<Booking>().HasIndex(b => new { b.PropertyId, b.CheckOut });

            // A payment is refunded at most once per purpose (full booking refund vs. caution return).
            modelBuilder.Entity<Refund>()
                .HasIndex(r => new { r.TransactionReference, r.Purpose })
                .IsUnique();
            modelBuilder.Entity<Refund>().HasIndex(r => r.BookingId);

            // Webhooks and the payout reconciler look withdrawals up by their payout reference.
            modelBuilder.Entity<Transaction>().HasIndex(t => t.Reference);
            modelBuilder.Entity<Transaction>().Property(t => t.Status).HasDefaultValue("Completed");

            modelBuilder.Entity<Booking>()
                .HasOne(b => b.Guest)
                .WithMany()
                .HasForeignKey(b => b.GuestId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}