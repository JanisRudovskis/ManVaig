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

        // Active bids — used for totals, highest, minNext
        var activeBids = await _db.Bids
            .Where(b => b.ItemId == itemId && b.Status == BidStatus.Active)
            .OrderByDescending(b => b.Amount)
            .Include(b => b.User)
            .ToListAsync();

        // Denied bids — shown at the end, not counted
        var deniedBids = await _db.Bids
            .Where(b => b.ItemId == itemId && b.Status == BidStatus.Denied)
            .OrderByDescending(b => b.Amount)
            .Include(b => b.User)
            .ToListAsync();

        var highestBid = activeBids.FirstOrDefault()?.Amount;

        // Calculate minimum next bid (active bids only)
        decimal? minNextBid = null;
        var topBid = activeBids.FirstOrDefault();
        var viewerIsHighest = currentUserId.HasValue && topBid?.UserId == currentUserId.Value;

        if (!item.IsSold)
        {
            var step = item.OfferStep ?? 0.01m;
            if (highestBid.HasValue)
            {
                minNextBid = highestBid.Value + step;
            }
            else
            {
                minNextBid = item.MinOfferPrice ?? step;
            }
            if (item.MinOfferPrice.HasValue && minNextBid < item.MinOfferPrice.Value)
                minNextBid = item.MinOfferPrice.Value;
        }

        // Active bids first (limited), then denied appended
        var limitedActive = activeBids.Take(limit).ToList();

        BidResponse MapBid(Bid b) => new()
        {
            Id = b.Id,
            BidderName = b.User.DisplayName ?? "User",
            BidderAvatarUrl = b.User.AvatarUrl,
            BidderId = b.UserId,
            Amount = b.Amount,
            IsOwnBid = currentUserId.HasValue && b.UserId == currentUserId.Value,
            Status = b.Status.ToString(),
            DenyReason = b.DenyReason,
            DenyDetail = b.DenyDetail,
            CreatedAt = b.CreatedAt,
        };

        var bidResponses = limitedActive.Select(MapBid).ToList();
        bidResponses.AddRange(deniedBids.Select(MapBid));

        // Check subscription state
        bool? isSubscribed = null;
        if (currentUserId.HasValue)
        {
            var sub = await _db.ItemSubscriptions
                .FirstOrDefaultAsync(s => s.ItemId == itemId && s.UserId == currentUserId.Value);
            // Owner: default subscribed (no row = true). Non-owner: default not subscribed (no row = false).
            isSubscribed = sub != null ? sub.IsActive : isOwner;
        }

        var response = new BidListResponse
        {
            TotalBids = activeBids.Count,  // only active count
            HighestBid = highestBid,
            MinNextBid = minNextBid,
            AcceptOffers = item.AcceptOffers,
            Price = item.Price,
            MinOfferPrice = item.MinOfferPrice,
            OfferStep = item.OfferStep,
            EndDate = item.EndDate,
            IsOwner = isOwner,
            IsSold = item.IsSold,
            IsSubscribed = isSubscribed,
            Bids = bidResponses,
        };

        // Seller view: unique bidders (active first, then denied)
        if (isOwner)
        {
            var topBidAmount = activeBids.FirstOrDefault()?.Amount ?? 0;

            var activeUnique = activeBids
                .GroupBy(b => b.UserId)
                .Select(g => new UniqueBidderResponse
                {
                    BidderId = g.Key,
                    BidderName = g.First().User.DisplayName ?? "User",
                    BidderAvatarUrl = g.First().User.AvatarUrl,
                    BestAmount = g.Max(b => b.Amount),
                    BidCount = g.Count(),
                    LastBidAt = g.Max(b => b.CreatedAt),
                    IsTop = g.Max(b => b.Amount) == topBidAmount,
                    IsDenied = false,
                })
                .OrderByDescending(ub => ub.BestAmount)
                .ToList();

            var deniedUnique = deniedBids
                .GroupBy(b => b.UserId)
                .Select(g => new UniqueBidderResponse
                {
                    BidderId = g.Key,
                    BidderName = g.First().User.DisplayName ?? "User",
                    BidderAvatarUrl = g.First().User.AvatarUrl,
                    BestAmount = g.Max(b => b.Amount),
                    BidCount = g.Count(),
                    LastBidAt = g.Max(b => b.CreatedAt),
                    IsTop = false,
                    IsDenied = true,
                    DenyReason = g.First().DenyReason,
                    DenyDetail = g.First().DenyDetail,
                })
                .OrderByDescending(ub => ub.BestAmount)
                .ToList();

            activeUnique.AddRange(deniedUnique);
            response.UniqueBidders = activeUnique;
        }

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

        // Auto-subscribe bidder (idempotent — reactivate if previously unsubscribed)
        var bidderSub = await _db.ItemSubscriptions
            .FirstOrDefaultAsync(s => s.ItemId == itemId && s.UserId == userId.Value);
        if (bidderSub == null)
        {
            _db.ItemSubscriptions.Add(new ItemSubscription
            {
                Id = Guid.NewGuid(),
                ItemId = itemId,
                UserId = userId.Value,
                IsActive = true,
            });
        }
        else if (!bidderSub.IsActive)
        {
            bidderSub.IsActive = true;
        }

        await _db.SaveChangesAsync();

        // Notify seller + subscribers about new bid
        await _notificationService.NotifyNewBidToSubscribers(item.UserId, userId.Value, itemId, bid.Id);

        return Ok(new { id = bid.Id, amount = bid.Amount, antiSnipe, updated = canUpdate });
    }

    /// <summary>
    /// Deny all active bids from a specific bidder on this item.
    /// Only the item owner can call this.
    /// </summary>
    [HttpPost("~/api/v1/items/{itemId:guid}/bidders/{bidderId:guid}/deny")]
    [Authorize]
    public async Task<IActionResult> DenyBidder(Guid itemId, Guid bidderId, [FromBody] DenyBidRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var item = await _db.Items.FirstOrDefaultAsync(i => i.Id == itemId);
        if (item == null) return NotFound(new { error = "ITEM_NOT_FOUND" });

        // Must be item owner
        if (item.UserId != userId.Value)
            return Forbid();

        // Validate reason
        var validReasons = new[] { "fake_or_accidental", "dont_trust", "other" };
        if (!validReasons.Contains(request.Reason))
            return BadRequest(new { error = "INVALID_DENY_REASON" });

        // Find all active bids from this bidder on this item
        var bidderBids = await _db.Bids
            .Where(b => b.ItemId == itemId && b.UserId == bidderId && b.Status == BidStatus.Active)
            .ToListAsync();

        if (bidderBids.Count == 0)
            return NotFound(new { error = "NO_ACTIVE_BIDS" });

        // Mark all as denied
        var now = DateTime.UtcNow;
        foreach (var bid in bidderBids)
        {
            bid.Status = BidStatus.Denied;
            bid.DenyReason = request.Reason;
            bid.DenyDetail = request.Reason == "other" ? request.Detail : null;
            bid.DeniedAt = now;
        }

        await _db.SaveChangesAsync();

        // Notify the bidder (use the highest bid for the notification)
        var highestDeniedBid = bidderBids.OrderByDescending(b => b.Amount).First();
        await _notificationService.NotifyBidDenied(bidderId, itemId, highestDeniedBid.Id, request.Reason);

        return Ok(new { denied = bidderBids.Count });
    }

    /// <summary>
    /// Subscribe to notifications for this item's bidding activity.
    /// </summary>
    [HttpPost("~/api/v1/items/{itemId:guid}/subscribe")]
    [Authorize]
    public async Task<IActionResult> Subscribe(Guid itemId)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var item = await _db.Items.FirstOrDefaultAsync(i => i.Id == itemId);
        if (item == null) return NotFound(new { error = "ITEM_NOT_FOUND" });

        var sub = await _db.ItemSubscriptions
            .FirstOrDefaultAsync(s => s.ItemId == itemId && s.UserId == userId.Value);

        if (sub == null)
        {
            _db.ItemSubscriptions.Add(new ItemSubscription
            {
                Id = Guid.NewGuid(),
                ItemId = itemId,
                UserId = userId.Value,
                IsActive = true,
            });
        }
        else if (!sub.IsActive)
        {
            sub.IsActive = true;
        }

        await _db.SaveChangesAsync();
        return Ok(new { subscribed = true });
    }

    /// <summary>
    /// Unsubscribe from notifications for this item's bidding activity.
    /// </summary>
    [HttpDelete("~/api/v1/items/{itemId:guid}/subscribe")]
    [Authorize]
    public async Task<IActionResult> Unsubscribe(Guid itemId)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var sub = await _db.ItemSubscriptions
            .FirstOrDefaultAsync(s => s.ItemId == itemId && s.UserId == userId.Value);

        if (sub != null)
        {
            // Keep the row but mark inactive (so we know they explicitly unsubscribed)
            sub.IsActive = false;
            await _db.SaveChangesAsync();
        }
        else
        {
            // No row existed — create one as inactive (explicit opt-out)
            _db.ItemSubscriptions.Add(new ItemSubscription
            {
                Id = Guid.NewGuid(),
                ItemId = itemId,
                UserId = userId.Value,
                IsActive = false,
            });
            await _db.SaveChangesAsync();
        }

        return Ok(new { subscribed = false });
    }

    private Guid? GetCurrentUserId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);

        return Guid.TryParse(raw, out var id) ? id : null;
    }
}
