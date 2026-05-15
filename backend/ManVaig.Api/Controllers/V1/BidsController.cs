using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using ManVaig.Api.Data;
using ManVaig.Api.Models;
using ManVaig.Api.Models.Dto;
using ManVaig.Api.Models.Enums;
using ManVaig.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ManVaig.Api.Controllers.V1;

[ApiController]
[Route("api/v1/items/{itemId:guid}/bids")]
public class BidsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly INotificationService _notificationService;

    public BidsController(AppDbContext db, INotificationService notificationService)
    {
        _db = db;
        _notificationService = notificationService;
    }

    /// <summary>
    /// Get bid list for an item (public — no auth required).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetBids(Guid itemId, [FromQuery] int limit = 5)
    {
        limit = Math.Clamp(limit, 1, 200);
        var item = await _db.Items.FirstOrDefaultAsync(i => i.Id == itemId);

        if (item == null)
            return NotFound(new { error = "ITEM_NOT_FOUND" });

        if (item.Visibility == ItemVisibility.Private)
            return NotFound(new { error = "ITEM_NOT_FOUND" });

        if (!item.AcceptOffers)
            return BadRequest(new { error = "OFFERS_NOT_ACCEPTED" });

        var currentUserId = GetCurrentUserId();
        var isOwner = currentUserId.HasValue && item.UserId == currentUserId.Value;

        var bids = await _db.Bids
            .Where(b => b.ItemId == itemId && b.Status == BidStatus.Active)
            .OrderByDescending(b => b.Amount)
            .Include(b => b.User)
            .ToListAsync();

        var highestBid = bids.FirstOrDefault()?.Amount;

        // Calculate minimum next bid
        decimal? minNextBid = null;
        var topBid = bids.FirstOrDefault();
        var viewerIsHighest = currentUserId.HasValue && topBid?.UserId == currentUserId.Value;

        if (!item.IsSold)
        {
            if (highestBid.HasValue)
            {
                if (viewerIsHighest)
                    minNextBid = highestBid.Value + 0.01m;
                else
                    minNextBid = highestBid.Value + (item.OfferStep ?? 0.01m);
            }
            else
            {
                minNextBid = item.MinOfferPrice ?? item.OfferStep ?? 0.01m;
            }
            if (item.MinOfferPrice.HasValue && minNextBid < item.MinOfferPrice.Value)
                minNextBid = item.MinOfferPrice.Value;
        }

        var limitedBids = bids.Take(limit).ToList();

        var response = new BidListResponse
        {
            TotalBids = bids.Count,
            HighestBid = highestBid,
            MinNextBid = minNextBid,
            AcceptOffers = item.AcceptOffers,
            Price = item.Price,
            MinOfferPrice = item.MinOfferPrice,
            OfferStep = item.OfferStep,
            EndDate = item.EndDate,
            IsOwner = isOwner,
            IsSold = item.IsSold,
            Bids = limitedBids.Select(b => new BidResponse
            {
                Id = b.Id,
                BidderName = b.User.DisplayName ?? "User",
                BidderAvatarUrl = b.User.AvatarUrl,
                BidderId = b.UserId,
                Amount = b.Amount,
                IsOwnBid = currentUserId.HasValue && b.UserId == currentUserId.Value,
                CreatedAt = b.CreatedAt
            }).ToList()
        };

        return Ok(response);
    }

    /// <summary>
    /// Place a bid/offer on an item that accepts offers.
    /// </summary>
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> PlaceBid(Guid itemId, [FromBody] PlaceBidRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var item = await _db.Items.FirstOrDefaultAsync(i => i.Id == itemId);
        if (item == null) return NotFound(new { error = "ITEM_NOT_FOUND" });

        if (item.Visibility == ItemVisibility.Private)
            return NotFound(new { error = "ITEM_NOT_FOUND" });

        if (!item.AcceptOffers)
            return BadRequest(new { error = "OFFERS_NOT_ACCEPTED" });

        if (item.IsSold)
            return BadRequest(new { error = "ITEM_SOLD" });

        // If timed, must not have ended
        if (item.EndDate.HasValue && item.EndDate.Value <= DateTime.UtcNow)
            return BadRequest(new { error = "OFFERS_ENDED" });

        // Can't bid on own item
        if (item.UserId == userId.Value)
            return BadRequest(new { error = "CANNOT_BID_OWN_ITEM" });

        if (request.Amount <= 0)
            return BadRequest(new { error = "BID_AMOUNT_POSITIVE" });

        // Get current highest active bid
        var highestActiveBid = await _db.Bids
            .Where(b => b.ItemId == itemId && b.Status == BidStatus.Active)
            .OrderByDescending(b => b.Amount)
            .FirstOrDefaultAsync();

        var currentHighest = highestActiveBid?.Amount ?? 0;

        // Find user's existing active bid (update-in-place, one per user)
        var existingBid = await _db.Bids
            .FirstOrDefaultAsync(b => b.ItemId == itemId
                && b.UserId == userId.Value
                && b.Status == BidStatus.Active);

        var canUpdate = existingBid != null;
        var isRaisingHighest = canUpdate && existingBid!.Id == highestActiveBid?.Id;

        if (request.Amount <= currentHighest)
            return BadRequest(new { error = "BID_TOO_LOW" });

        if (item.MinOfferPrice.HasValue && request.Amount < item.MinOfferPrice.Value)
            return BadRequest(new { error = "BID_BELOW_STARTING" });

        if (!isRaisingHighest && item.OfferStep.HasValue && item.OfferStep.Value > 0 && highestActiveBid != null)
        {
            var minNext = currentHighest + item.OfferStep.Value;
            if (request.Amount < minNext)
                return BadRequest(new { error = "BID_STEP_TOO_SMALL" });
        }

        Bid bid;

        if (canUpdate)
        {
            bid = existingBid!;
            bid.Amount = request.Amount;
            bid.CreatedAt = DateTime.UtcNow;
        }
        else
        {
            bid = new Bid
            {
                Id = Guid.NewGuid(),
                ItemId = itemId,
                UserId = userId.Value,
                Amount = request.Amount,
                Status = BidStatus.Active,
                CreatedAt = DateTime.UtcNow
            };
            _db.Bids.Add(bid);
        }

        // Anti-sniping: only for timed items, if bid placed in last 10 minutes
        var antiSnipe = false;
        if (item.EndDate.HasValue)
        {
            var timeUntilEnd = item.EndDate.Value - DateTime.UtcNow;
            if (timeUntilEnd.TotalMinutes <= 10)
            {
                item.EndDate = DateTime.SpecifyKind(
                    DateTime.UtcNow.AddMinutes(10),
                    DateTimeKind.Utc
                );
                antiSnipe = true;
            }
        }

        await _db.SaveChangesAsync();

        // Notify seller about new bid
        await _notificationService.NotifyNewBid(item.UserId, userId.Value, itemId, bid.Id);

        return Ok(new { id = bid.Id, amount = bid.Amount, antiSnipe, updated = canUpdate });
    }

    private Guid? GetCurrentUserId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);

        return Guid.TryParse(raw, out var id) ? id : null;
    }
}
