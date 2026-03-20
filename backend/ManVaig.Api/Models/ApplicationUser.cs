using Microsoft.AspNetCore.Identity;

namespace ManVaig.Api.Models;

public class ApplicationUser : IdentityUser<Guid>
{
    public string? DisplayName { get; set; }
    public string? AvatarUrl { get; set; }
    public string? Bio { get; set; }
    public string? Location { get; set; }
    public string? Phone { get; set; }
    public bool IsProfilePublic { get; set; } = true;
    public CommunicationChannels EnabledChannels { get; set; } = CommunicationChannels.None;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<UserBadge> UserBadges { get; set; } = new List<UserBadge>();
    public ICollection<UserDisplayedBadge> DisplayedBadges { get; set; } = new List<UserDisplayedBadge>();
}
