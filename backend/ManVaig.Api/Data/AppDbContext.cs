using ManVaig.Api.Models;
using ManVaig.Api.Models.Enums;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace ManVaig.Api.Data;

public class AppDbContext : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<BadgeDefinition> BadgeDefinitions => Set<BadgeDefinition>();
    public DbSet<UserBadge> UserBadges => Set<UserBadge>();
    public DbSet<UserDisplayedBadge> UserDisplayedBadges => Set<UserDisplayedBadge>();

    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<Item> Items => Set<Item>();
    public DbSet<ItemImage> ItemImages => Set<ItemImage>();
    public DbSet<ItemTag> ItemTags => Set<ItemTag>();
    public DbSet<Bid> Bids => Set<Bid>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // === ApplicationUser ===
        builder.Entity<ApplicationUser>(entity =>
        {
            entity.Property(u => u.DisplayName).HasMaxLength(100);
            entity.HasIndex(u => u.DisplayName).IsUnique();
            entity.Property(u => u.AvatarUrl).HasMaxLength(500);
            entity.Property(u => u.Bio).HasMaxLength(1000);
            entity.Property(u => u.Location).HasMaxLength(200);
            entity.Property(u => u.Phone).HasMaxLength(30);
            entity.Property(u => u.MaxItems).HasDefaultValue(10);
        });

        // === BadgeDefinition ===
        builder.Entity<BadgeDefinition>(entity =>
        {
            entity.Property(b => b.Key).HasMaxLength(50);
            entity.HasIndex(b => b.Key).IsUnique();
            entity.Property(b => b.Name).HasMaxLength(100);
            entity.Property(b => b.Description).HasMaxLength(500);
            entity.Property(b => b.IconUrl).HasMaxLength(500);

            entity.HasData(new BadgeDefinition
            {
                Id = 1,
                Key = "top_1000",
                Name = "Top 1000",
                Description = "One of the first 1000 users on the platform",
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            });
        });

        // === UserBadge ===
        builder.Entity<UserBadge>(entity =>
        {
            entity.HasKey(ub => new { ub.UserId, ub.BadgeDefinitionId });
            entity.HasOne(ub => ub.User).WithMany(u => u.UserBadges).HasForeignKey(ub => ub.UserId);
            entity.HasOne(ub => ub.BadgeDefinition).WithMany(b => b.UserBadges).HasForeignKey(ub => ub.BadgeDefinitionId);
        });

        // === UserDisplayedBadge ===
        builder.Entity<UserDisplayedBadge>(entity =>
        {
            entity.HasKey(db => new { db.UserId, db.BadgeDefinitionId });
            entity.HasOne(db => db.User).WithMany(u => u.DisplayedBadges).HasForeignKey(db => db.UserId);
            entity.HasOne(db => db.BadgeDefinition).WithMany().HasForeignKey(db => db.BadgeDefinitionId);
        });

        // === Category ===
        builder.Entity<Category>(entity =>
        {
            entity.Property(c => c.Name).HasMaxLength(100);
            entity.HasIndex(c => c.Name).IsUnique();

            entity.HasData(
                new Category { Id = 1, Name = "Electronics", SortOrder = 0 },
                new Category { Id = 2, Name = "Clothing & Accessories", SortOrder = 1 },
                new Category { Id = 3, Name = "Antiques & Collectibles", SortOrder = 2 },
                new Category { Id = 4, Name = "Home & Garden", SortOrder = 3 },
                new Category { Id = 5, Name = "Sports & Outdoors", SortOrder = 4 },
                new Category { Id = 6, Name = "Vehicles & Parts", SortOrder = 5 },
                new Category { Id = 7, Name = "Books & Media", SortOrder = 6 },
                new Category { Id = 8, Name = "Musical Instruments", SortOrder = 7 },
                new Category { Id = 9, Name = "Toys & Hobbies", SortOrder = 8 },
                new Category { Id = 10, Name = "Health & Beauty", SortOrder = 9 },
                new Category { Id = 11, Name = "Building Materials", SortOrder = 10 },
                new Category { Id = 12, Name = "Other", SortOrder = 11 }
            );
        });

        // === Tag ===
        builder.Entity<Tag>(entity =>
        {
            entity.Property(t => t.Name).HasMaxLength(50);
            entity.HasIndex(t => t.Name).IsUnique();
        });

        // === Item ===
        builder.Entity<Item>(entity =>
        {
            entity.Property(i => i.Title).HasMaxLength(200);
            entity.Property(i => i.Description).HasMaxLength(5000);
            entity.Property(i => i.Location).HasMaxLength(200);
            entity.Property(i => i.Price).HasPrecision(10, 2);
            entity.Property(i => i.MinBidPrice).HasPrecision(10, 2);
            entity.Property(i => i.BidStep).HasPrecision(10, 2);

            entity.HasOne(i => i.User)
                .WithMany(u => u.Items)
                .HasForeignKey(i => i.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(i => i.Category)
                .WithMany(c => c.Items)
                .HasForeignKey(i => i.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(i => i.UserId);
            entity.HasIndex(i => i.CategoryId);
            entity.HasIndex(i => i.CreatedAt);
        });

        // === ItemImage ===
        builder.Entity<ItemImage>(entity =>
        {
            entity.Property(ii => ii.Url).HasMaxLength(500);

            entity.HasOne(ii => ii.Item)
                .WithMany(i => i.Images)
                .HasForeignKey(ii => ii.ItemId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // === ItemTag ===
        builder.Entity<ItemTag>(entity =>
        {
            entity.HasKey(it => new { it.ItemId, it.TagId });

            entity.HasOne(it => it.Item)
                .WithMany(i => i.ItemTags)
                .HasForeignKey(it => it.ItemId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(it => it.Tag)
                .WithMany(t => t.ItemTags)
                .HasForeignKey(it => it.TagId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // === Bid ===
        builder.Entity<Bid>(entity =>
        {
            entity.Property(b => b.Amount).HasPrecision(10, 2);

            entity.HasOne(b => b.Item)
                .WithMany(i => i.Bids)
                .HasForeignKey(b => b.ItemId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(b => b.User)
                .WithMany()
                .HasForeignKey(b => b.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(b => b.ItemId);
            entity.HasIndex(b => new { b.ItemId, b.Amount });
        });
    }
}
