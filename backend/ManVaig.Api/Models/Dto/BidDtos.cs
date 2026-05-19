using System.ComponentModel.DataAnnotations;

namespace ManVaig.Api.Models.Dto;

public class PlaceBidRequest
{
    [Required]
    public decimal Amount { get; set; }
}

public class BidResponse
{
    public Guid Id { get; set; }
    public string BidderName { get; set; } = default!;
    public string? BidderAvatarUrl { get; set; }
    public Guid BidderId { get; set; }
    public decimal Amount { get; set; }
    public bool IsOwnBid { get; set; }
    public string Status { get; set; } = "Active";
    public string? DenyReason { get; set; }
    public string? DenyDetail { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class BidListResponse
{
    public List<BidResponse> Bids { get; set; } = new();
    public int TotalBids { get; set; }
    public decimal? HighestBid { get; set; }
    public decimal? MinNextBid { get; set; }

    // Item context
    public bool AcceptOffers { get; set; }
    public decimal? Price { get; set; }
    public decimal? MinOfferPrice { get; set; }
    public decimal? OfferStep { get; set; }
    public DateTime? EndDate { get; set; }
    public bool IsOwner { get; set; }
    public bool IsSold { get; set; }

    // Subscription state (null if not authenticated)
    public bool? IsSubscribed { get; set; }

    // Instant buy
    public decimal? InstantBuyPrice { get; set; }
    public PendingInstantBuyResponse? PendingInstantBuy { get; set; }

    // Sold state
    public SoldToResponse? SoldTo { get; set; }
    public bool CanReopen { get; set; }

    // Seller view: unique bidders with aggregated stats
    public List<UniqueBidderResponse>? UniqueBidders { get; set; }
}

public class SoldToResponse
{
    public string BuyerId { get; set; } = default!;
    public string BuyerDisplayName { get; set; } = default!;
    public string? BuyerAvatarUrl { get; set; }
    public decimal Amount { get; set; }
    public bool IsInstantBuy { get; set; }
}

public class PendingInstantBuyResponse
{
    public string BuyerId { get; set; } = default!;
    public string BuyerDisplayName { get; set; } = default!;
    public string? BuyerAvatarUrl { get; set; }
    public decimal Amount { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool IsOwnInstantBuy { get; set; }
}

public class UniqueBidderResponse
{
    public Guid BidderId { get; set; }
    public string BidderName { get; set; } = default!;
    public string? BidderAvatarUrl { get; set; }
    public decimal BestAmount { get; set; }
    public int BidCount { get; set; }
    public DateTime LastBidAt { get; set; }
    public bool IsTop { get; set; }
    public bool IsDenied { get; set; }
    public string? DenyReason { get; set; }
    public string? DenyDetail { get; set; }
}

public class DenyBidRequest
{
    [Required]
    public string Reason { get; set; } = default!;  // fake_or_accidental | dont_trust | other
    public string? Detail { get; set; }  // only when reason == other
}
