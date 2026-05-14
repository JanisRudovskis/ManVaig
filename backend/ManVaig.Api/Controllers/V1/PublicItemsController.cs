using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using ManVaig.Api.Data;
using ManVaig.Api.Models;
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
    /// Browse public items (no auth required). Supports category, price, type, condition filters + sorting + pagination.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Browse(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] int? categoryId = null,
        [FromQuery] string? q = null,
        [FromQuery] decimal? priceMin = null,
        [FromQuery] decimal? priceMax = null,
        [FromQuery] string? types = null,
        [FromQuery] string? conditions = null,
        [FromQuery] string? sort = null)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var query = _db.Items
            .Where(i => i.Visibility == ItemVisibility.Public)
            .Where(i => i.Stall.Visibility == StallVisibility.Public);

        if (categoryId.HasValue)
            query = query.Where(i => i.CategoryId == categoryId.Value);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var trimmed = q.Trim();
            if (trimmed.Length > 100) trimmed = trimmed.Substring(0, 100);
            var pattern = $"%{trimmed}%";
            query = query.Where(i =>
                EF.Functions.ILike(EF.Functions.Unaccent(i.Title), EF.Functions.Unaccent(pattern)) ||
                (i.Description != null && EF.Functions.ILike(EF.Functions.Unaccent(i.Description), EF.Functions.Unaccent(pattern))) ||
                i.ItemTags.Any(it => EF.Functions.ILike(EF.Functions.Unaccent(it.Tag.Name), EF.Functions.Unaccent(pattern))));
        }

        // Price range filter — offer-only items (Price == null) are included so they're
        // not silently hidden; users can exclude them via the type filter.
        if (priceMin.HasValue && priceMin.Value >= 0)
            query = query.Where(i => i.Price == null || i.Price >= priceMin.Value);

        if (priceMax.HasValue && priceMax.Value >= 0)
            query = query.Where(i => i.Price == null || i.Price <= priceMax.Value);

        // Listing type filter — comma-separated: "fixed", "offers", "timed"
        if (!string.IsNullOrWhiteSpace(types))
        {
            var typeSet = types.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(t => t.Trim().ToLowerInvariant())
                .ToHashSet();

            if (typeSet.Count > 0 && typeSet.Count < 3) // all 3 selected = no filter needed
            {
                var wantFixed = typeSet.Contains("fixed");
                var wantOffers = typeSet.Contains("offers");
                var wantTimed = typeSet.Contains("timed");

                query = query.Where(i =>
                    (wantFixed && i.Price != null) ||
                    (wantOffers && i.AcceptOffers) ||
                    (wantTimed && i.EndDate != null));
            }
        }

        // Condition filter — comma-separated int values: "0,1,2"
        if (!string.IsNullOrWhiteSpace(conditions))
        {
            var condList = conditions.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(c => int.TryParse(c.Trim(), out var v) && v >= 0 && v <= 4 ? (Condition?)v : null)
                .Where(v => v.HasValue)
                .Select(v => v!.Value)
                .Distinct()
                .ToList();

            if (condList.Count > 0 && condList.Count < 5) // all 5 selected = no filter
                query = query.Where(i => condList.Contains(i.Condition));
        }

        var totalCount = await query.CountAsync();

        // Sort
        IOrderedQueryable<Item> ordered = sort switch
        {
            "oldest" => query.OrderBy(i => i.CreatedAt),
            "priceAsc" => query.OrderBy(i => i.Price ?? decimal.MaxValue),
            "priceDesc" => query.OrderByDescending(i => i.Price ?? decimal.MinValue),
            _ => query.OrderByDescending(i => i.CreatedAt) // "newest" default
        };

        var items = await ordered
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(i => new PublicItemCardDto
            {
                Id = i.Id,
                Title = i.Title,
                CategoryId = i.CategoryId,
                CategoryName = i.Category.Name,
                Condition = i.Condition,
                Price = i.Price,
                AcceptOffers = i.AcceptOffers,
                MinOfferPrice = i.MinOfferPrice,
                OfferStep = i.OfferStep,
                EndDate = i.EndDate,
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
                BidCount = i.Bids.Count(b => b.Status == BidStatus.Active),
                HighestBid = i.Bids.Any(b => b.Status == BidStatus.Active)
                    ? i.Bids.Where(b => b.Status == BidStatus.Active).Max(b => b.Amount)
                    : (decimal?)null,
                BiddingPaused = i.Bids.Any(b => b.Status == BidStatus.Accepted),
                BiddingClosed = i.Bids.Any(b => b.Status == BidStatus.Completed)
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
            .Include(i => i.Stall)
            .Include(i => i.Images.OrderBy(img => img.SortOrder))
            .Include(i => i.ItemTags).ThenInclude(it => it.Tag)
            .Include(i => i.User)
            .Include(i => i.Bids)
            .FirstOrDefaultAsync(i => i.Id == id);

        if (item == null)
            return NotFound(new { error = "ITEM_NOT_FOUND" });

        var currentUserId = GetCurrentUserId();
        var isAuthenticated = User.Identity?.IsAuthenticated == true;
        var isOwner = currentUserId.HasValue && item.UserId == currentUserId.Value;

        // Stall visibility gate runs FIRST — owner always passes through.
        if (!isOwner)
        {
            switch (item.Stall.Visibility)
            {
                case StallVisibility.Private:
                    return NotFound(new { error = "ITEM_NOT_FOUND" });

                case StallVisibility.RegisteredOnly:
                    if (!isAuthenticated)
                        return Unauthorized(new { error = "LOGIN_REQUIRED" });
                    break;

                case StallVisibility.Public:
                case StallVisibility.LinkOnly:
                    // Fall through to item-visibility switch
                    break;
            }
        }

        // Item visibility check (existing logic, unchanged).
        switch (item.Visibility)
        {
            case ItemVisibility.Private:
                return NotFound(new { error = "ITEM_NOT_FOUND" });

            case ItemVisibility.RegisteredOnly:
                if (!isAuthenticated)
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
            IsOwner = isOwner,
            Title = item.Title,
            Description = item.Description,
            CategoryId = item.CategoryId,
            CategoryName = item.Category?.Name ?? "",
            Condition = item.Condition,
            Price = item.Price,
            AcceptOffers = item.AcceptOffers,
            MinOfferPrice = item.MinOfferPrice,
            OfferStep = item.OfferStep,
            EndDate = item.EndDate,
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
            BidCount = item.Bids?.Count(b => b.Status == BidStatus.Active) ?? 0,
            HighestBid = item.Bids != null && item.Bids.Any(b => b.Status == BidStatus.Active)
                ? item.Bids.Where(b => b.Status == BidStatus.Active).Max(b => b.Amount)
                : null,
            BiddingPaused = item.Bids?.Any(b => b.Status == BidStatus.Accepted) ?? false,
            BiddingClosed = item.Bids?.Any(b => b.Status == BidStatus.Completed) ?? false
        };

        return Ok(detail);
    }

    private Guid? GetCurrentUserId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return Guid.TryParse(raw, out var id) ? id : null;
    }
}
