using System.ComponentModel.DataAnnotations;
using ManVaig.Api.Models.Enums;

namespace ManVaig.Api.Models.Dto;

public class CreateItemRequest
{
    /// <summary>
    /// Stall to add the item to. If not provided and user has 0 stalls, a default stall is created.
    /// </summary>
    public Guid? StallId { get; set; }

    [Required, MinLength(3), MaxLength(100)]
    public string Title { get; set; } = default!;

    [MaxLength(2000)]
    public string? Description { get; set; }

    public int CategoryId { get; set; }

    public Condition Condition { get; set; } = Condition.Used;

    public PricingType PricingType { get; set; } = PricingType.Fixed;

    public decimal? Price { get; set; }
    public decimal? MinBidPrice { get; set; }
    public decimal? BidStep { get; set; }
    public DateTime? AuctionEnd { get; set; }

    public ItemVisibility Visibility { get; set; } = ItemVisibility.Public;

    [MaxLength(200)]
    public string? Location { get; set; }

    public bool CanShip { get; set; }
    public bool AllowGuestOffers { get; set; }

    public List<string>? Tags { get; set; }
}

public class UpdateItemRequest
{
    [MinLength(3), MaxLength(100)]
    public string? Title { get; set; }

    [MaxLength(2000)]
    public string? Description { get; set; }

    public int? CategoryId { get; set; }

    public Condition? Condition { get; set; }

    public PricingType? PricingType { get; set; }

    public decimal? Price { get; set; }
    public decimal? MinBidPrice { get; set; }
    public decimal? BidStep { get; set; }
    public DateTime? AuctionEnd { get; set; }

    public ItemVisibility? Visibility { get; set; }

    [MaxLength(200)]
    public string? Location { get; set; }

    public bool? CanShip { get; set; }
    public bool? AllowGuestOffers { get; set; }

    public List<string>? Tags { get; set; }

    /// <summary>
    /// Sentinel to distinguish "field not sent" from "set to null".
    /// When true, nullable pricing fields (Price, MinBidPrice, BidStep, AuctionEnd)
    /// will be cleared even if sent as null.
    /// </summary>
    public bool ClearPricingFields { get; set; }

    /// <summary>
    /// Move item to a different stall. If null, stall is unchanged.
    /// </summary>
    public Guid? StallId { get; set; }
}

public class ItemResponse
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid StallId { get; set; }
    public string StallName { get; set; } = default!;
    public string Title { get; set; } = default!;
    public string? Description { get; set; }
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = default!;
    public Condition Condition { get; set; }
    public PricingType PricingType { get; set; }
    public decimal? Price { get; set; }
    public decimal? MinBidPrice { get; set; }
    public decimal? BidStep { get; set; }
    public DateTime? AuctionEnd { get; set; }
    public ItemVisibility Visibility { get; set; }
    public string? Location { get; set; }
    public bool CanShip { get; set; }
    public bool AllowGuestOffers { get; set; }
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    /// <summary>Number of active bids on this item.</summary>
    public int BidCount { get; set; }
    /// <summary>Highest active bid amount, null if no bids.</summary>
    public decimal? HighestBid { get; set; }

    public List<ItemImageDto> Images { get; set; } = new();
    public List<string> Tags { get; set; } = new();
}

public class ItemImageDto
{
    public Guid Id { get; set; }
    public string Url { get; set; } = default!;
    public int SortOrder { get; set; }
    public bool IsPrimary { get; set; }
}

public class ItemListResponse
{
    public List<ItemResponse> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}

public class CategoryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = default!;
    public int SortOrder { get; set; }
}

public class TagDto
{
    public int Id { get; set; }
    public string Name { get; set; } = default!;
}

public class ReorderImagesRequest
{
    public List<Guid> ImageIds { get; set; } = new();
}

public class ReorderItemsRequest
{
    public Guid StallId { get; set; }
    public List<Guid> ItemIds { get; set; } = new();
}
