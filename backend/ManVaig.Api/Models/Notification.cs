using ManVaig.Api.Models.Enums;

namespace ManVaig.Api.Models;

public class Notification
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = default!;

    public NotificationType Type { get; set; }

    public Guid? ActorId { get; set; }
    public ApplicationUser? Actor { get; set; }

    public Guid? ItemId { get; set; }
    public Item? Item { get; set; }

    public Guid? BidId { get; set; }
    public Bid? Bid { get; set; }

    public bool IsRead { get; set; } = false;
    public int GroupCount { get; set; } = 1;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
