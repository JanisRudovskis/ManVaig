using System.ComponentModel.DataAnnotations;

namespace ManVaig.Api.Models.Dto;

public class UserProfileResponse
{
    public Guid UserId { get; set; }
    public string DisplayName { get; set; } = default!;
    public string? Email { get; set; }
    public bool? EmailConfirmed { get; set; }
    public string? Phone { get; set; }
    public bool? PhoneVerified { get; set; }
    public string? AvatarUrl { get; set; }
    public string? Bio { get; set; }
    public string? Location { get; set; }
    public bool IsProfilePublic { get; set; }
    public CommunicationChannels EnabledChannels { get; set; }
    public string? TelegramUsername { get; set; }
    public DateTime MemberSince { get; set; }
    public DateTime? LastSeenAt { get; set; }
    public List<BadgeDto> DisplayedBadges { get; set; } = new();

    // Public contact info (only populated for public viewers when channel is enabled)
    public string? PublicEmail { get; set; }
    public string? PublicPhone { get; set; }
    public string? PublicWhatsAppUrl { get; set; }
    public string? PublicTelegramUrl { get; set; }

    // Stats (computed, not stored)
    public int StallCount { get; set; }
    public int ActiveListingCount { get; set; }
    public int CompletedDealCount { get; set; }
    public int FollowerCount { get; set; }
    public int FollowingCount { get; set; }
    public bool? IsFollowedByMe { get; set; } // null for anonymous
}

public class BadgeDto
{
    public int Id { get; set; }
    public string Key { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? IconUrl { get; set; }
}

public class FollowUserDto
{
    public Guid UserId { get; set; }
    public string DisplayName { get; set; } = "";
    public string? AvatarUrl { get; set; }
    public string? Location { get; set; }
    public DateTime FollowedSince { get; set; }
}

public class FollowListResponse
{
    public List<FollowUserDto> Users { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}

public class UpdateProfileRequest
{
    [MaxLength(1000)]
    public string? Bio { get; set; }

    [MaxLength(200)]
    public string? Location { get; set; }

    [MaxLength(30)]
    public string? Phone { get; set; }

    public bool? IsProfilePublic { get; set; }
    public CommunicationChannels? EnabledChannels { get; set; }

    [MaxLength(50)]
    public string? TelegramUsername { get; set; }

    public List<int>? DisplayedBadgeIds { get; set; }
}
