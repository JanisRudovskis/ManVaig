using ManVaig.Api.Data;
using ManVaig.Api.Models.Dto;
using ManVaig.Api.Models.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ManVaig.Api.Controllers.V1;

[ApiController]
[Route("api/v1/public/items")]
public class PublicItemsController : ControllerBase
{
    private readonly AppDbContext _db;

    public PublicItemsController(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Browse public items (no auth required). Supports category filter + pagination.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Browse(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] int? categoryId = null)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var query = _db.Items
            .Where(i => i.Visibility == ItemVisibility.Public);

        if (categoryId.HasValue)
            query = query.Where(i => i.CategoryId == categoryId.Value);

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(i => i.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(i => new PublicItemCardDto
            {
                Id = i.Id,
                Title = i.Title,
                CategoryId = i.CategoryId,
                CategoryName = i.Category.Name,
                Condition = i.Condition,
                PricingType = i.PricingType,
                Price = i.Price,
                MinBidPrice = i.MinBidPrice,
                BidStep = i.BidStep,
                AuctionEnd = i.AuctionEnd,
                Location = i.Location,
                CanShip = i.CanShip,
                CreatedAt = i.CreatedAt,
                Images = i.Images
                    .OrderBy(img => img.SortOrder)
                    .Select(img => new ItemImageDto
                    {
                        Id = img.Id,
                        Url = img.Url,
                        SortOrder = img.SortOrder,
                        IsPrimary = img.IsPrimary
                    }).ToList(),
                Tags = i.ItemTags.Select(it => it.Tag.Name).ToList(),
                Seller = new PublicSellerSummaryDto
                {
                    DisplayName = i.User.DisplayName ?? "User",
                    AvatarUrl = i.User.AvatarUrl,
                    Location = i.User.Location,
                    MemberSince = i.User.CreatedAt
                },
                BidCount = i.Bids.Count(),
                HighestBid = i.Bids.Any() ? i.Bids.Max(b => b.Amount) : null
            })
            .ToListAsync();

        return Ok(new PublicItemListResponse
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        });
    }

    /// <summary>
    /// Get public item detail (no auth required for Public/LinkOnly items).
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetItem(Guid id)
    {
        var item = await _db.Items
            .Include(i => i.Category)
            .Include(i => i.Images.OrderBy(img => img.SortOrder))
            .Include(i => i.ItemTags).ThenInclude(it => it.Tag)
            .Include(i => i.User)
            .Include(i => i.Bids)
            .FirstOrDefaultAsync(i => i.Id == id);

        if (item == null)
            return NotFound(new { error = "ITEM_NOT_FOUND" });

        // Visibility check
        switch (item.Visibility)
        {
            case ItemVisibility.Private:
                return NotFound(new { error = "ITEM_NOT_FOUND" });

            case ItemVisibility.RegisteredOnly:
                if (User.Identity?.IsAuthenticated != true)
                    return Unauthorized(new { error = "LOGIN_REQUIRED" });
                break;

            case ItemVisibility.Public:
            case ItemVisibility.LinkOnly:
                // Accessible freely
                break;
        }

        var detail = new PublicItemDetailDto
        {
            Id = item.Id,
            Title = item.Title,
            Description = item.Description,
            CategoryId = item.CategoryId,
            CategoryName = item.Category?.Name ?? "",
            Condition = item.Condition,
            PricingType = item.PricingType,
            Price = item.Price,
            MinBidPrice = item.MinBidPrice,
            BidStep = item.BidStep,
            AuctionEnd = item.AuctionEnd,
            Location = item.Location,
            CanShip = item.CanShip,
            AllowGuestOffers = item.AllowGuestOffers,
            CreatedAt = item.CreatedAt,
            Images = item.Images?.Select(img => new ItemImageDto
            {
                Id = img.Id,
                Url = img.Url,
                SortOrder = img.SortOrder,
                IsPrimary = img.IsPrimary
            }).ToList() ?? new(),
            Tags = item.ItemTags?.Select(it => it.Tag.Name).ToList() ?? new(),
            Seller = new PublicSellerDetailDto
            {
                DisplayName = item.User?.DisplayName ?? "User",
                AvatarUrl = item.User?.AvatarUrl,
                Location = item.User?.Location,
                Bio = item.User?.Bio,
                MemberSince = item.User?.CreatedAt ?? DateTime.UtcNow
            },
            BidCount = item.Bids?.Count ?? 0,
            HighestBid = item.Bids != null && item.Bids.Any()
                ? item.Bids.Max(b => b.Amount)
                : null
        };

        return Ok(detail);
    }
}
