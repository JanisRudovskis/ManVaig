using ManVaig.Api.Models.Enums;

namespace ManVaig.Api.Models;

public class Bid
{
    public Guid Id { get; set; }

    public Guid ItemId { get; set; }
    public Item Item { get; set; } = default!;

    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = default!;

    public decimal Amount { get; set; }
    public BidStatus Status { get; set; } = BidStatus.Active;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
