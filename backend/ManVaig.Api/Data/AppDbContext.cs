using ManVaig.Api.Models;
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

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<ApplicationUser>(entity =>
        {
            entity.Property(u => u.DisplayName).HasMaxLength(100);
            entity.HasIndex(u => u.DisplayName).IsUnique();
            entity.Property(u => u.AvatarUrl).HasMaxLength(500);
            entity.Property(u => u.Bio).HasMaxLength(1000);
            entity.Property(u => u.Location).HasMaxLength(200);
            entity.Property(u => u.Phone).HasMaxLength(30);
        });

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

        builder.Entity<UserBadge>(entity =>
        {
            entity.HasKey(ub => new { ub.UserId, ub.BadgeDefinitionId });
            entity.HasOne(ub => ub.User).WithMany(u => u.UserBadges).HasForeignKey(ub => ub.UserId);
            entity.HasOne(ub => ub.BadgeDefinition).WithMany(b => b.UserBadges).HasForeignKey(ub => ub.BadgeDefinitionId);
        });

        builder.Entity<UserDisplayedBadge>(entity =>
        {
            entity.HasKey(db => new { db.UserId, db.BadgeDefinitionId });
            entity.HasOne(db => db.User).WithMany(u => u.DisplayedBadges).HasForeignKey(db => db.UserId);
            entity.HasOne(db => db.BadgeDefinition).WithMany().HasForeignKey(db => db.BadgeDefinitionId);
        });
    }
}
