using ManVaig.Api.Models.Enums;

namespace ManVaig.Api.Models.Dto;

// === Seller DTOs (safe to expose publicly) ===

public class PublicSellerSummaryDto
{
    public string DisplayName { get; set; } = default!;
    public string? AvatarUrl { get; set; }
    public string? Location { get; set; }
    public DateTime MemberSince { get; set; }
}

public class PublicSellerDetailDto : PublicSellerSummaryDto
{
    public Guid SellerId { get; set; }
    public string? Bio { get; set; }
}

// === Item card DTO (for feed listing) ===

public class PublicItemCardDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = default!;
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = default!;
    public Condition Condition { get; set; }

    // Composable pricing fields
    public decimal? Price { get; set; }
    public bool AcceptOffers { get; set; }
    public decimal? MinOfferPrice { get; set; }
    public decimal? OfferStep { get; set; }
    public DateTime? EndDate { get; set; }

    public string? Location { get; set; }
    public bool CanShip { get; set; }
    public bool IsSold { get; set; }
    public DateTime CreatedAt { get; set; }

    public List<ItemImageDto> Images { get; set; } = new();
    public List<string> Tags { get; set; } = new();

    // Seller summary (never exposes UserId, email, phone)
    public PublicSellerSummaryDto Seller { get; set; } = default!;

    // Offer summary
    public int BidCount { get; set; }
    public decimal? HighestBid { get; set; }
}

// === Item detail DTO (for detail page) ===

public class PublicItemDetailDto : PublicItemCardDto
{
    public string? Description { get; set; }

    /// <summary>True if the currently authenticated user owns this item.</summary>
    public bool IsOwner { get; set; }

    // Seller with bio for detail page
    public new PublicSellerDetailDto Seller { get; set; } = default!;
}

// === List response ===

public class PublicItemListResponse
{
    public List<PublicItemCardDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}
