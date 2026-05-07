using System.ComponentModel.DataAnnotations;

namespace ManVaig.Api.Models.Dto;

public class PlaceBidRequest
{
    [Required]
    public decimal Amount { get; set; }
    public bool IsAnonymous { get; set; } = false;
}

public class BidResponse
{
    public Guid Id { get; set; }

    // Bidder identity
    public string? BidderName { get; set; }
    public string? BidderAvatarUrl { get; set; }
    public string? BidderInitial { get; set; }
    public bool IsAnonymous { get; set; }
    public string BidderLabel { get; set; } = default!; // "Bidder #N" for anon, display name otherwise

    // Contact info — only after Accepted/Completed, only for relevant parties
    public string? BidderContact { get; set; }
    public string? SellerContact { get; set; }

    public decimal Amount { get; set; }
    public string Status { get; set; } = default!; // Active, Accepted, Completed, Denied, Failed
    public bool IsOwnBid { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? AcceptedAt { get; set; }
}

public class BidListResponse
{
    public List<BidResponse> Bids { get; set; } = new();
    public int TotalBids { get; set; }
    public int TotalAllBids { get; set; }
    public decimal? HighestActiveBid { get; set; }
    public decimal? MinNextBid { get; set; }

    // Item context (needed by popup to show status)
    public bool AcceptOffers { get; set; }
    public decimal? Price { get; set; }
    public decimal? MinOfferPrice { get; set; }
    public decimal? OfferStep { get; set; }
    public DateTime? EndDate { get; set; }
    public bool IsOwner { get; set; }
    public bool BiddingPaused { get; set; }
    public bool BiddingClosed { get; set; }
    public int FailedDealCount { get; set; }
    public int UniqueBidders { get; set; }
}
