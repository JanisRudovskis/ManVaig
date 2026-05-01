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
    public int MaxItems { get; set; } = 10;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastEmailSentAt { get; set; }

    public ICollection<UserBadge> UserBadges { get; set; } = new List<UserBadge>();
    public ICollection<UserDisplayedBadge> DisplayedBadges { get; set; } = new List<UserDisplayedBadge>();
    public ICollection<Stall> Stalls { get; set; } = new List<Stall>();
    public ICollection<Item> Items { get; set; } = new List<Item>();
}
