namespace ManVaig.Api.Models;

public class ItemSubscription
{
    public Guid Id { get; set; }

    public Guid ItemId { get; set; }
    public Item Item { get; set; } = default!;

    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = default!;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
