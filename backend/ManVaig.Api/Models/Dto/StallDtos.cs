using System.ComponentModel.DataAnnotations;

namespace ManVaig.Api.Models.Dto;

public class CreateStallRequest
{
    [Required, MinLength(3), MaxLength(50)]
    public string Name { get; set; } = default!;

    [MaxLength(500)]
    public string? Description { get; set; }

    [MaxLength(7)]
    public string? AccentColor { get; set; }
}

public class UpdateStallRequest
{
    [MinLength(3), MaxLength(50)]
    public string? Name { get; set; }

    [MinLength(3), MaxLength(50)]
    public string? Slug { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    [MaxLength(7)]
    public string? AccentColor { get; set; }
}

public class StallResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = default!;
    public string Slug { get; set; } = default!;
    public string? Description { get; set; }
    public string? ThumbnailUrl { get; set; }
    public string? HeaderImageUrl { get; set; }
    public string? BackgroundImageUrl { get; set; }
    public string? AccentColor { get; set; }
    public int SortOrder { get; set; }
    public bool IsDefault { get; set; }
    public int ItemCount { get; set; }
    public List<string> PreviewImageUrls { get; set; } = new();
    public List<Guid> FeaturedItemIds { get; set; } = new();
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class StallListResponse
{
    public List<StallResponse> Stalls { get; set; } = new();
    public int TotalItemCount { get; set; }
    public int MaxItems { get; set; }
}

public class ReorderStallsRequest
{
    public List<Guid> StallIds { get; set; } = new();
}

public class PublicStallResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = default!;
    public string Slug { get; set; } = default!;
    public string? Description { get; set; }
    public string? ThumbnailUrl { get; set; }
    public string? HeaderImageUrl { get; set; }
    public string? BackgroundImageUrl { get; set; }
    public string? AccentColor { get; set; }
    public int ItemCount { get; set; }
    public List<string> PreviewImageUrls { get; set; } = new();
    public PublicStallOwnerDto Owner { get; set; } = default!;
}

public class PublicStallOwnerDto
{
    public string DisplayName { get; set; } = default!;
    public string? AvatarUrl { get; set; }
    public string? Location { get; set; }
}
