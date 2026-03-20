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
    public DateTime MemberSince { get; set; }
    public List<BadgeDto> DisplayedBadges { get; set; } = new();
}

public class BadgeDto
{
    public int Id { get; set; }
    public string Key { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? IconUrl { get; set; }
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
    public List<int>? DisplayedBadgeIds { get; set; }
}
