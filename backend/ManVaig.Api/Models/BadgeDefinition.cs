namespace ManVaig.Api.Models;

public class BadgeDefinition
{
    public int Id { get; set; }
    public string Key { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public string? IconUrl { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<UserBadge> UserBadges { get; set; } = new List<UserBadge>();
}
