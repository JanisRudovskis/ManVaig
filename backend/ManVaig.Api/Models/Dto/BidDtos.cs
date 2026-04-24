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
    public string BidderLabel { get; set; } = default!; // "Bidder #1", "Bidder #2", etc.
    public string? BidderName { get; set; } // Real name — only after auction ends, only for winner
    public string? BidderContact { get; set; } // Email/phone — only after auction ends, only for winner
    public decimal Amount { get; set; }
    public string Status { get; set; } = default!; // Active, Won, Expired
    public bool IsWinner { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class BidListResponse
{
    public List<BidResponse> Bids { get; set; } = new();
    public int TotalBids { get; set; }
    public decimal? HighestBid { get; set; }
    public bool AuctionEnded { get; set; }
    public DateTime? WinnerExpiresAt { get; set; } // 24h after auction end
}
