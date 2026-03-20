namespace ManVaig.Api.Models;

public class UserDisplayedBadge
{
    public Guid UserId { get; set; }
    public int BadgeDefinitionId { get; set; }
    public int SortOrder { get; set; }

    public ApplicationUser User { get; set; } = default!;
    public BadgeDefinition BadgeDefinition { get; set; } = default!;
}
