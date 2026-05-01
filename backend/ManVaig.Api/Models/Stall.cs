namespace ManVaig.Api.Models;

public class Stall
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = default!;

    public string Name { get; set; } = default!;
    public string Slug { get; set; } = default!;
    public string? Description { get; set; }

    public string? ThumbnailUrl { get; set; }
    public string? HeaderImageUrl { get; set; }
    public string? BackgroundImageUrl { get; set; }
    public string? AccentColor { get; set; }

    public int SortOrder { get; set; }
    public bool IsDefault { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Item> Items { get; set; } = new List<Item>();
    public ICollection<StallFeaturedItem> FeaturedItems { get; set; } = new List<StallFeaturedItem>();
}
