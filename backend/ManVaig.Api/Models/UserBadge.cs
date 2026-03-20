namespace ManVaig.Api.Models;

public class UserBadge
{
    public Guid UserId { get; set; }
    public int BadgeDefinitionId { get; set; }
    public DateTime AwardedAt { get; set; } = DateTime.UtcNow;

    public ApplicationUser User { get; set; } = default!;
    public BadgeDefinition BadgeDefinition { get; set; } = default!;
}
