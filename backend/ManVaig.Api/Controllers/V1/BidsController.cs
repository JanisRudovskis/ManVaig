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

        // InstantBuy bids — shown in list with special tag, not counted in totals
        var instantBuyBids = await _db.Bids
            .Where(b => b.ItemId == itemId && b.Status == BidStatus.InstantBuy)
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
        bidResponses.AddRange(instantBuyBids.Select(MapBid));
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

        // Check for pending instant buy
        var pendingIb = await _db.Bids
            .Include(b => b.User)
            .FirstOrDefaultAsync(b => b.ItemId == itemId && b.Status == BidStatus.InstantBuy);

        PendingInstantBuyResponse? pendingIbResponse = null;
        if (pendingIb != null && !item.IsSold)
        {
            pendingIbResponse = new PendingInstantBuyResponse
            {
                BuyerId = pendingIb.UserId.ToString(),
                BuyerDisplayName = pendingIb.User.DisplayName ?? "User",
                BuyerAvatarUrl = pendingIb.User.AvatarUrl,
                Amount = pendingIb.Amount,
                CreatedAt = pendingIb.CreatedAt,
                IsOwnInstantBuy = currentUserId.HasValue && pendingIb.UserId == currentUserId.Value,
            };
        }

        // Instant buy price: item.Price when AcceptOffers is on and price exists
        decimal? instantBuyPrice = (item.AcceptOffers && item.Price.HasValue) ? item.Price : null;
        // Hide instant buy when bids reach 70% of the listed price (bidding is competitive enough)
        if (instantBuyPrice.HasValue && highestBid.HasValue && highestBid.Value >= instantBuyPrice.Value * 0.7m)
            instantBuyPrice = null;

        // Watcher count: active subscribers (excluding owner)
        var watcherCount = await _db.ItemSubscriptions
            .CountAsync(s => s.ItemId == itemId && s.IsActive && s.UserId != item.UserId);

        // Sold state: identify winner and determine if reopen is available
        SoldToResponse? soldTo = null;
        var canReopen = false;
        if (item.IsSold)
        {
            // Winner is: the InstantBuy bid if exists, otherwise highest active bid
            var winnerBid = instantBuyBids.FirstOrDefault() ?? activeBids.FirstOrDefault();
            if (winnerBid != null)
            {
                soldTo = new SoldToResponse
                {
                    BuyerId = winnerBid.UserId.ToString(),
                    BuyerDisplayName = winnerBid.User.DisplayName ?? "User",
                    BuyerAvatarUrl = winnerBid.User.AvatarUrl,
                    Amount = winnerBid.Amount,
                    IsInstantBuy = winnerBid.IsInstantBuy || winnerBid.Status == BidStatus.InstantBuy,
                };
            }

            // Reopen is only available for instant buy sales + time remaining (or no end date)
            var soldViaIb = winnerBid?.Status == BidStatus.InstantBuy || winnerBid?.IsInstantBuy == true;
            var hasTimeLeft = !item.EndDate.HasValue || item.EndDate.Value > DateTime.UtcNow;
            canReopen = soldViaIb && hasTimeLeft;
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
            InstantBuyPrice = instantBuyPrice,
            PendingInstantBuy = pendingIbResponse,
            WatcherCount = watcherCount,
            SoldTo = soldTo,
            CanReopen = canReopen,
            Bids = bidResponses,
        };

        // Seller view: unique bidders (active + instant buy first, then denied-only)
        if (isOwner)
        {
            // Combine active + instant buy bids for the "live" section
            var liveBids = activeBids.Concat(instantBuyBids).ToList();
            var topBidAmount = liveBids.OrderByDescending(b => b.Amount).FirstOrDefault()?.Amount ?? 0;
            var liveUserIds = new HashSet<Guid>(liveBids.Select(b => b.UserId));

            var activeUnique = liveBids
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

            // Denied: only users who don't also have a live bid
            var deniedUnique = deniedBids
                .Where(b => !liveUserIds.Contains(b.UserId))
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

        // Can't bid if you have a pending instant buy on this item
        var hasOwnPendingIb = await _db.Bids
            .AnyAsync(b => b.ItemId == itemId && b.UserId == userId.Value && b.Status == BidStatus.InstantBuy);
        if (hasOwnPendingIb)
            return BadRequest(new { error = "INSTANT_BUY_PENDING" });

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

        if (item.OfferStep.HasValue && item.OfferStep.Value > 0 && highestActiveBid != null)
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

        // Notify seller only about new bid
        await _notificationService.NotifyNewBidToSeller(item.UserId, userId.Value, itemId, bid.Id);

        // Notify previous top bidder they've been outbid
        if (highestActiveBid != null && highestActiveBid.UserId != userId.Value)
        {
            await _notificationService.NotifyOutbid(highestActiveBid.UserId, userId.Value, itemId, bid.Id);
        }

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

        // Find all active + instant buy bids from this bidder on this item
        var bidderBids = await _db.Bids
            .Where(b => b.ItemId == itemId && b.UserId == bidderId
                && (b.Status == BidStatus.Active || b.Status == BidStatus.InstantBuy))
            .ToListAsync();

        if (bidderBids.Count == 0)
            return NotFound(new { error = "NO_ACTIVE_BIDS" });

        // Check if this bidder is the winner before denying
        var isWinner = false;
        if (item.IsSold)
        {
            // Winner = InstantBuy bid, or highest active bid
            var winnerBid = await _db.Bids
                .Where(b => b.ItemId == itemId && b.Status == BidStatus.InstantBuy)
                .FirstOrDefaultAsync()
                ?? await _db.Bids
                    .Where(b => b.ItemId == itemId && b.Status == BidStatus.Active)
                    .OrderByDescending(b => b.Amount)
                    .FirstOrDefaultAsync();
            isWinner = winnerBid != null && winnerBid.UserId == bidderId;
        }

        // Mark all as denied
        var now = DateTime.UtcNow;
        foreach (var bid in bidderBids)
        {
            bid.Status = BidStatus.Denied;
            bid.DenyReason = request.Reason;
            bid.DenyDetail = request.Reason == "other" ? request.Detail : null;
            bid.DeniedAt = now;
        }

        // If this bidder was the winner → unsell
        var unsold = false;
        if (isWinner)
        {
            item.IsSold = false;
            unsold = true;
        }

        await _db.SaveChangesAsync();

        // Notify the denied bidder
        var highestDeniedBid = bidderBids.OrderByDescending(b => b.Amount).First();
        await _notificationService.NotifyBidDenied(bidderId, itemId, highestDeniedBid.Id, request.Reason);

        return Ok(new { denied = bidderBids.Count, unsold });
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

    /// <summary>
    /// Buyer initiates an instant buy at the listed price.
    /// Creates a bid with Status=InstantBuy, locking bidding until seller accepts/declines.
    /// </summary>
    [HttpPost("~/api/v1/items/{itemId:guid}/instant-buy")]
    [Authorize]
    public async Task<IActionResult> PlaceInstantBuy(Guid itemId)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var item = await _db.Items.FirstOrDefaultAsync(i => i.Id == itemId);
        if (item == null) return NotFound(new { error = "ITEM_NOT_FOUND" });

        if (item.IsSold)
            return BadRequest(new { error = "INSTANT_BUY_ITEM_SOLD" });

        if (!item.AcceptOffers || !item.Price.HasValue)
            return BadRequest(new { error = "INSTANT_BUY_NOT_AVAILABLE" });

        if (item.UserId == userId.Value)
            return BadRequest(new { error = "CANNOT_BID_OWN_ITEM" });

        if (item.EndDate.HasValue && item.EndDate.Value <= DateTime.UtcNow)
            return BadRequest(new { error = "OFFERS_ENDED" });

        // Check highest bid doesn't already meet/exceed price
        var highestBid = await _db.Bids
            .Where(b => b.ItemId == itemId && b.Status == BidStatus.Active)
            .MaxAsync(b => (decimal?)b.Amount);
        if (highestBid.HasValue && highestBid.Value >= item.Price.Value)
            return BadRequest(new { error = "INSTANT_BUY_NOT_AVAILABLE" });

        // Only one pending instant buy at a time
        var alreadyPending = await _db.Bids
            .AnyAsync(b => b.ItemId == itemId && b.Status == BidStatus.InstantBuy);
        if (alreadyPending)
            return Conflict(new { error = "INSTANT_BUY_ALREADY_PENDING" });

        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            ItemId = itemId,
            UserId = userId.Value,
            Amount = item.Price.Value,
            Status = BidStatus.InstantBuy,
            IsInstantBuy = true,
            CreatedAt = DateTime.UtcNow,
        };
        _db.Bids.Add(bid);

        // Auto-subscribe buyer
        var sub = await _db.ItemSubscriptions
            .FirstOrDefaultAsync(s => s.ItemId == itemId && s.UserId == userId.Value);
        if (sub == null)
            _db.ItemSubscriptions.Add(new ItemSubscription
            {
                Id = Guid.NewGuid(),
                ItemId = itemId,
                UserId = userId.Value,
                IsActive = true,
            });
        else if (!sub.IsActive)
            sub.IsActive = true;

        await _db.SaveChangesAsync();

        await _notificationService.NotifyInstantBuyRequested(item.UserId, userId.Value, itemId);

        return Ok(new { id = bid.Id, amount = bid.Amount });
    }

    /// <summary>
    /// Seller accepts the pending instant buy — marks item as sold.
    /// </summary>
    [HttpPost("~/api/v1/items/{itemId:guid}/instant-buy/accept")]
    [Authorize]
    public async Task<IActionResult> AcceptInstantBuy(Guid itemId)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var item = await _db.Items.FirstOrDefaultAsync(i => i.Id == itemId);
        if (item == null) return NotFound(new { error = "ITEM_NOT_FOUND" });

        if (item.UserId != userId.Value)
            return BadRequest(new { error = "INSTANT_BUY_NOT_SELLER" });

        if (item.IsSold)
            return BadRequest(new { error = "ITEM_SOLD" });

        var pendingBid = await _db.Bids
            .FirstOrDefaultAsync(b => b.ItemId == itemId && b.Status == BidStatus.InstantBuy);
        if (pendingBid == null)
            return BadRequest(new { error = "INSTANT_BUY_NOT_PENDING" });

        item.IsSold = true;
        await _db.SaveChangesAsync();

        // Notify the buyer that their instant buy was accepted
        await _notificationService.NotifyInstantBuyAccepted(pendingBid.UserId, itemId);

        return Ok(new { sold = true });
    }

    /// <summary>
    /// Seller declines the pending instant buy — unlocks bidding.
    /// </summary>
    [HttpPost("~/api/v1/items/{itemId:guid}/instant-buy/decline")]
    [Authorize]
    public async Task<IActionResult> DeclineInstantBuy(Guid itemId)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var item = await _db.Items.FirstOrDefaultAsync(i => i.Id == itemId);
        if (item == null) return NotFound(new { error = "ITEM_NOT_FOUND" });

        if (item.UserId != userId.Value)
            return BadRequest(new { error = "INSTANT_BUY_NOT_SELLER" });

        var pendingBid = await _db.Bids
            .FirstOrDefaultAsync(b => b.ItemId == itemId && b.Status == BidStatus.InstantBuy);
        if (pendingBid == null)
            return BadRequest(new { error = "INSTANT_BUY_NOT_PENDING" });

        pendingBid.Status = BidStatus.Denied;
        pendingBid.DenyReason = "instant_buy_declined";
        pendingBid.DeniedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await _notificationService.NotifyInstantBuyDeclined(pendingBid.UserId, itemId);

        return Ok(new { declined = true });
    }

    /// <summary>
    /// Re-open a sold listing. Only for instant buy sales with time remaining (or no end date).
    /// Undoes the sale, notifies all subscribers.
    /// </summary>
    [HttpPost("~/api/v1/items/{itemId:guid}/reopen")]
    [Authorize]
    public async Task<IActionResult> ReopenItem(Guid itemId)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var item = await _db.Items.FirstOrDefaultAsync(i => i.Id == itemId);
        if (item == null) return NotFound(new { error = "ITEM_NOT_FOUND" });

        if (item.UserId != userId.Value)
            return BadRequest(new { error = "NOT_SELLER" });

        if (!item.IsSold)
            return BadRequest(new { error = "ITEM_NOT_SOLD" });

        // Find the winning bid — either InstantBuy status or the highest active bid that was an IB
        var winnerBid = await _db.Bids
            .FirstOrDefaultAsync(b => b.ItemId == itemId && b.Status == BidStatus.InstantBuy);

        // Fallback: if accepted IB changed status to Active, find by IsInstantBuy flag or highest active
        if (winnerBid == null)
        {
            winnerBid = await _db.Bids
                .Where(b => b.ItemId == itemId && b.Status == BidStatus.Active && b.IsInstantBuy)
                .FirstOrDefaultAsync();
        }

        // Last resort: treat the highest active bid as the winner (for legacy data)
        if (winnerBid == null)
        {
            winnerBid = await _db.Bids
                .Where(b => b.ItemId == itemId && b.Status == BidStatus.Active)
                .OrderByDescending(b => b.Amount)
                .FirstOrDefaultAsync();
        }

        if (winnerBid == null)
            return BadRequest(new { error = "REOPEN_NOT_ALLOWED" });

        // Check time remaining (or no end date)
        if (item.EndDate.HasValue && item.EndDate.Value <= DateTime.UtcNow)
            return BadRequest(new { error = "REOPEN_TIME_ELAPSED" });

        // Deny the winning bid
        winnerBid.Status = BidStatus.Denied;
        winnerBid.DenyReason = "sale_reopened";
        winnerBid.DeniedAt = DateTime.UtcNow;

        item.IsSold = false;
        await _db.SaveChangesAsync();

        // Notify the winner their bid was cancelled
        await _notificationService.NotifyInstantBuyDeclined(winnerBid.UserId, itemId);

        return Ok(new { reopened = true });
    }

    /// <summary>
    /// Close the auction permanently. Denies all bids, turns off offers,
    /// item becomes read-only (seller can only delete).
    /// </summary>
    [HttpPost("~/api/v1/items/{itemId:guid}/close-auction")]
    [Authorize]
    public async Task<IActionResult> CloseAuction(Guid itemId)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var item = await _db.Items.FirstOrDefaultAsync(i => i.Id == itemId);
        if (item == null) return NotFound(new { error = "ITEM_NOT_FOUND" });

        if (item.UserId != userId.Value)
            return BadRequest(new { error = "NOT_SELLER" });

        if (!item.IsSold)
            return BadRequest(new { error = "ITEM_NOT_SOLD" });

        // Deny all active and instant buy bids
        var allBids = await _db.Bids
            .Where(b => b.ItemId == itemId
                && (b.Status == BidStatus.Active || b.Status == BidStatus.InstantBuy))
            .ToListAsync();

        foreach (var bid in allBids)
        {
            bid.Status = BidStatus.Denied;
            bid.DenyReason = "auction_closed";
            bid.DeniedAt = DateTime.UtcNow;
        }

        item.IsSold = false;
        item.AcceptOffers = false;
        await _db.SaveChangesAsync();

        await _notificationService.NotifyAuctionClosedToSubscribers(itemId, userId.Value);

        return Ok(new { closed = true });
    }

    /// <summary>
    /// Seller explicitly sells the item to a specific bidder.
    /// Sets IsSold=true, notifies winner + all subscribers.
    /// </summary>
    [HttpPost("~/api/v1/items/{itemId:guid}/sell-to/{bidderId:guid}")]
    [Authorize]
    public async Task<IActionResult> SellToBidder(Guid itemId, Guid bidderId)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var item = await _db.Items.FirstOrDefaultAsync(i => i.Id == itemId);
        if (item == null) return NotFound(new { error = "ITEM_NOT_FOUND" });

        if (item.UserId != userId.Value)
            return BadRequest(new { error = "NOT_SELLER" });

        if (item.IsSold)
            return BadRequest(new { error = "ITEM_SOLD" });

        var winnerBid = await _db.Bids
            .FirstOrDefaultAsync(b => b.ItemId == itemId
                && b.UserId == bidderId
                && b.Status == BidStatus.Active);
        if (winnerBid == null)
            return BadRequest(new { error = "BIDDER_NOT_FOUND" });

        item.IsSold = true;
        await _db.SaveChangesAsync();

        await _notificationService.NotifyBidWon(bidderId, itemId, winnerBid.Id);

        return Ok(new { sold = true, soldTo = bidderId });
    }

    private Guid? GetCurrentUserId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);

        return Guid.TryParse(raw, out var id) ? id : null;
    }
}
