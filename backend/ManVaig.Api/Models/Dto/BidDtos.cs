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
}
