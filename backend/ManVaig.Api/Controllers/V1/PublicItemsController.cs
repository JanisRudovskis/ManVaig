using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
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
        [FromQuery] int? categoryId = null,
        [FromQuery] string? q = null)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var query = _db.Items
            .Where(i => i.Visibility == ItemVisibility.Public);

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

        // Check if the current user owns this item
        var currentUserId = GetCurrentUserId();
        var isOwner = currentUserId.HasValue && item.UserId == currentUserId.Value;

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
