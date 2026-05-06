using ManVaig.Api.Models.Enums;

namespace ManVaig.Api.Models;

public class Item
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = default!;

    public Guid StallId { get; set; }
    public Stall Stall { get; set; } = default!;

    public int CategoryId { get; set; }
    public Category Category { get; set; } = default!;

    public string Title { get; set; } = default!;
    public string? Description { get; set; }
    public Condition Condition { get; set; } = Condition.Used;

    public PricingType PricingType { get; set; } = PricingType.Fixed;
    public decimal? Price { get; set; }
    public decimal? MinBidPrice { get; set; }
    public decimal? BidStep { get; set; }
    public DateTime? AuctionEnd { get; set; }

    public ItemVisibility Visibility { get; set; } = ItemVisibility.Public;
    public string? Location { get; set; }
    public bool CanShip { get; set; }
    public bool AllowGuestOffers { get; set; }

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<ItemImage> Images { get; set; } = new List<ItemImage>();
    public ICollection<ItemTag> ItemTags { get; set; } = new List<ItemTag>();
    public ICollection<Bid> Bids { get; set; } = new List<Bid>();
    public ICollection<StallFeaturedItem> StallFeaturedItems { get; set; } = new List<StallFeaturedItem>();
}
