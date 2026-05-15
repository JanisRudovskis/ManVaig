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
    /// Response varies based on viewer role (owner, bidder, anonymous).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetBids(Guid itemId, [FromQuery] int limit = 5)
    {
        limit = Math.Clamp(limit, 1, 200);
        var item = await _db.Items
            .Include(i => i.User)
            .FirstOrDefaultAsync(i => i.Id == itemId);

        if (item == null)
            return NotFound(new { error = "ITEM_NOT_FOUND" });

        if (item.Visibility == ItemVisibility.Private)
            return NotFound(new { error = "ITEM_NOT_FOUND" });

        if (!item.AcceptOffers)
            return BadRequest(new { error = "OFFERS_NOT_ACCEPTED" });

        var currentUserId = GetCurrentUserId();
        var isOwner = currentUserId.HasValue && item.UserId == currentUserId.Value;

        var bids = await _db.Bids
            .Where(b => b.ItemId == itemId)
            .OrderByDescending(b => b.Amount)
            .Include(b => b.User)
            .ToListAsync();

        // Build anonymized bidder labels: assign "Bidder #N" per unique user in order of first bid
        var bidderLabels = new Dictionary<Guid, int>();
        var labelCounter = 0;
        foreach (var bid in bids.OrderBy(b => b.CreatedAt))
        {
            if (!bidderLabels.ContainsKey(bid.UserId))
            {
                labelCounter++;
                bidderLabels[bid.UserId] = labelCounter;
            }
        }

        var activeBids = bids.Where(b => b.Status == BidStatus.Active).ToList();
        var highestActive = activeBids.FirstOrDefault()?.Amount;
        var biddingPaused = bids.Any(b => b.Status == BidStatus.Accepted);
        var biddingClosed = bids.Any(b => b.Status == BidStatus.Completed);

        // Calculate minimum next bid
        decimal? minNextBid = null;
        var topBid = activeBids.FirstOrDefault();
        var viewerIsHighest = currentUserId.HasValue && topBid?.UserId == currentUserId.Value;

        if (!biddingPaused && !biddingClosed)
        {
            if (highestActive.HasValue)
            {
                if (viewerIsHighest)
                {
                    // User is raising own bid — just needs to exceed current amount
                    minNextBid = highestActive.Value + 0.01m;
                }
                else
                {
                    // Outbidding someone else — must respect offerStep
                    minNextBid = highestActive.Value + (item.OfferStep ?? 0.01m);
                }
            }
            else
            {
                minNextBid = item.MinOfferPrice ?? item.OfferStep ?? 0.01m;
            }
            // Floor: must be at least minOfferPrice
            if (item.MinOfferPrice.HasValue && minNextBid < item.MinOfferPrice.Value)
                minNextBid = item.MinOfferPrice.Value;
        }

        // Apply limit to the bids returned (but totals are computed from all)
        var limitedBids = bids.Take(limit).ToList();

        var response = new BidListResponse
        {
            TotalBids = activeBids.Count,
            TotalAllBids = bids.Count,
            HighestActiveBid = highestActive,
            MinNextBid = minNextBid,
            AcceptOffers = item.AcceptOffers,
            Price = item.Price,
            MinOfferPrice = item.MinOfferPrice,
            OfferStep = item.OfferStep,
            EndDate = item.EndDate,
            IsOwner = isOwner,
            BiddingPaused = biddingPaused,
            BiddingClosed = biddingClosed,
            UniqueBidders = bids.Where(b => b.Status == BidStatus.Active)
                .Select(b => new { b.UserId, b.IsAnonymous }).Distinct().Count(),
            FailedDealCount = bids.Count(b => b.Status == BidStatus.Failed),
            Bids = limitedBids.Select(b =>
            {
                var isOwnBid = currentUserId.HasValue && b.UserId == currentUserId.Value;
                var isBidAcceptedOrCompleted = b.Status is BidStatus.Accepted or BidStatus.Completed;

                // Determine what identity info to show
                string? bidderName = null;
                string? bidderAvatarUrl = null;
                string? bidderInitial = null;
                string bidderLabel;

                if (b.IsAnonymous)
                {
                    bidderLabel = $"Bidder #{bidderLabels[b.UserId]}";
                    if (isOwnBid)
                    {
                        // You always see your own name
                        bidderName = b.User.DisplayName;
                        bidderAvatarUrl = b.User.AvatarUrl;
                        bidderInitial = b.User.DisplayName?.Length > 0
                            ? b.User.DisplayName[0].ToString().ToUpper()
                            : null;
                    }
                }
                else
                {
                    bidderName = b.User.DisplayName ?? "User";
                    bidderAvatarUrl = b.User.AvatarUrl;
                    bidderInitial = bidderName.Length > 0
                        ? bidderName[0].ToString().ToUpper()
                        : null;
                    bidderLabel = bidderName;
                }

                // Contact info: only for relevant parties after acceptance
                string? bidderContact = null;
                string? sellerContact = null;

                if (isBidAcceptedOrCompleted)
                {
                    if (isOwner)
                    {
                        // Seller sees bidder's email
                        bidderContact = b.User.Email;
                    }
                    if (isOwnBid)
                    {
                        // Accepted bidder sees seller's email
                        sellerContact = item.User.Email;
                    }
                }

                return new BidResponse
                {
                    Id = b.Id,
                    BidderName = bidderName,
                    BidderAvatarUrl = bidderAvatarUrl,
                    BidderInitial = bidderInitial,
                    IsAnonymous = b.IsAnonymous,
                    BidderLabel = bidderLabel,
                    BidderContact = bidderContact,
                    SellerContact = sellerContact,
                    Amount = b.Amount,
                    Status = b.Status.ToString(),
                    IsOwnBid = isOwnBid,
                    CreatedAt = b.CreatedAt,
                    AcceptedAt = b.AcceptedAt
                };
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

        // Visibility check
        if (item.Visibility == ItemVisibility.Private)
            return NotFound(new { error = "ITEM_NOT_FOUND" });

        // Must accept offers
        if (!item.AcceptOffers)
            return BadRequest(new { error = "OFFERS_NOT_ACCEPTED" });

        // If timed, must not have ended
        if (item.EndDate.HasValue && item.EndDate.Value <= DateTime.UtcNow)
            return BadRequest(new { error = "OFFERS_ENDED" });

        // Can't bid on own item
        if (item.UserId == userId.Value)
            return BadRequest(new { error = "CANNOT_BID_OWN_ITEM" });

        // Amount must be positive
        if (request.Amount <= 0)
            return BadRequest(new { error = "BID_AMOUNT_POSITIVE" });

        // Check if bidding is paused (accepted bid) or closed (completed bid)
        var hasAccepted = await _db.Bids.AnyAsync(b => b.ItemId == itemId && b.Status == BidStatus.Accepted);
        if (hasAccepted)
            return BadRequest(new { error = "BIDDING_PAUSED" });

        var hasCompleted = await _db.Bids.AnyAsync(b => b.ItemId == itemId && b.Status == BidStatus.Completed);
        if (hasCompleted)
            return BadRequest(new { error = "BIDDING_CLOSED" });

        // Get current highest ACTIVE bid (exclude Denied/Failed)
        var highestActiveBid = await _db.Bids
            .Where(b => b.ItemId == itemId && b.Status == BidStatus.Active)
            .OrderByDescending(b => b.Amount)
            .FirstOrDefaultAsync();

        var currentHighest = highestActiveBid?.Amount ?? 0;

        // Find user's existing active bid with the same anonymity mode
        // Each user can have max 1 anon + 1 non-anon active bid
        var existingBid = await _db.Bids
            .FirstOrDefaultAsync(b => b.ItemId == itemId
                && b.UserId == userId.Value
                && b.Status == BidStatus.Active
                && b.IsAnonymous == request.IsAnonymous);

        var canUpdate = existingBid != null;
        // Skip offerStep when raising own bid that IS the current highest
        var isRaisingHighest = canUpdate && existingBid!.Id == highestActiveBid?.Id;

        // Must be higher than current highest active bid
        if (request.Amount <= currentHighest)
            return BadRequest(new { error = "BID_TOO_LOW" });

        // Must be >= min offer price (floor)
        if (item.MinOfferPrice.HasValue && request.Amount < item.MinOfferPrice.Value)
            return BadRequest(new { error = "BID_BELOW_STARTING" });

        // Must respect offer step (skip when raising own highest bid)
        if (!isRaisingHighest && item.OfferStep.HasValue && item.OfferStep.Value > 0 && highestActiveBid != null)
        {
            var minNext = currentHighest + item.OfferStep.Value;
            if (request.Amount < minNext)
                return BadRequest(new { error = "BID_STEP_TOO_SMALL" });
        }

        Bid bid;

        if (canUpdate)
        {
            // Update existing bid in place (same user, same anonymity mode)
            bid = existingBid!;
            bid.Amount = request.Amount;
            bid.CreatedAt = DateTime.UtcNow;
        }
        else
        {
            // Create new bid
            bid = new Bid
            {
                Id = Guid.NewGuid(),
                ItemId = itemId,
                UserId = userId.Value,
                Amount = request.Amount,
                IsAnonymous = request.IsAnonymous,
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

    /// <summary>
    /// Accept a bid — pauses bidding, reveals contact info (owner only).
    /// </summary>
    [HttpPost("{bidId:guid}/accept")]
    [Authorize]
    public async Task<IActionResult> AcceptBid(Guid itemId, Guid bidId)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var item = await _db.Items.FirstOrDefaultAsync(i => i.Id == itemId && i.UserId == userId.Value);
        if (item == null) return NotFound(new { error = "ITEM_NOT_FOUND" });

        var bid = await _db.Bids
            .Include(b => b.User)
            .FirstOrDefaultAsync(b => b.Id == bidId && b.ItemId == itemId);
        if (bid == null) return NotFound(new { error = "BID_NOT_FOUND" });

        if (bid.Status != BidStatus.Active)
            return BadRequest(new { error = "BID_NOT_ACTIVE" });

        // Check no other bid is already accepted
        var hasAccepted = await _db.Bids.AnyAsync(b => b.ItemId == itemId && b.Status == BidStatus.Accepted);
        if (hasAccepted)
            return BadRequest(new { error = "ALREADY_HAS_ACCEPTED" });

        // Check no bid is completed
        var hasCompleted = await _db.Bids.AnyAsync(b => b.ItemId == itemId && b.Status == BidStatus.Completed);
        if (hasCompleted)
            return BadRequest(new { error = "BIDDING_CLOSED" });

        bid.Status = BidStatus.Accepted;
        bid.AcceptedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        // Notify bidder that their bid was accepted
        await _notificationService.NotifyBidAccepted(bid.UserId, itemId, bid.Id);

        return Ok(new
        {
            id = bid.Id,
            amount = bid.Amount,
            bidderName = bid.User.DisplayName,
            bidderContact = bid.User.Email
        });
    }

    /// <summary>
    /// Complete a deal — marks item as sold (owner only).
    /// </summary>
    [HttpPost("{bidId:guid}/complete")]
    [Authorize]
    public async Task<IActionResult> CompleteBid(Guid itemId, Guid bidId)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var item = await _db.Items.FirstOrDefaultAsync(i => i.Id == itemId && i.UserId == userId.Value);
        if (item == null) return NotFound(new { error = "ITEM_NOT_FOUND" });

        var bid = await _db.Bids.FirstOrDefaultAsync(b => b.Id == bidId && b.ItemId == itemId);
        if (bid == null) return NotFound(new { error = "BID_NOT_FOUND" });

        if (bid.Status != BidStatus.Accepted)
            return BadRequest(new { error = "BID_NOT_ACCEPTED" });

        bid.Status = BidStatus.Completed;

        await _db.SaveChangesAsync();

        return Ok(new { id = bid.Id, amount = bid.Amount });
    }

    /// <summary>
    /// Mark deal as failed — reopens bidding (owner only).
    /// </summary>
    [HttpPost("{bidId:guid}/fail")]
    [Authorize]
    public async Task<IActionResult> FailBid(Guid itemId, Guid bidId)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var item = await _db.Items.FirstOrDefaultAsync(i => i.Id == itemId && i.UserId == userId.Value);
        if (item == null) return NotFound(new { error = "ITEM_NOT_FOUND" });

        var bid = await _db.Bids.FirstOrDefaultAsync(b => b.Id == bidId && b.ItemId == itemId);
        if (bid == null) return NotFound(new { error = "BID_NOT_FOUND" });

        if (bid.Status != BidStatus.Accepted)
            return BadRequest(new { error = "BID_NOT_ACCEPTED" });

        bid.Status = BidStatus.Failed;

        await _db.SaveChangesAsync();

        return Ok(new { id = bid.Id, amount = bid.Amount });
    }

    /// <summary>
    /// Deny a bid — seller rejects it, doesn't count for minimum (owner only).
    /// </summary>
    [HttpPost("{bidId:guid}/deny")]
    [Authorize]
    public async Task<IActionResult> DenyBid(Guid itemId, Guid bidId)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var item = await _db.Items.FirstOrDefaultAsync(i => i.Id == itemId && i.UserId == userId.Value);
        if (item == null) return NotFound(new { error = "ITEM_NOT_FOUND" });

        var bid = await _db.Bids.FirstOrDefaultAsync(b => b.Id == bidId && b.ItemId == itemId);
        if (bid == null) return NotFound(new { error = "BID_NOT_FOUND" });

        if (bid.Status != BidStatus.Active)
            return BadRequest(new { error = "BID_NOT_ACTIVE" });

        bid.Status = BidStatus.Denied;

        await _db.SaveChangesAsync();

        return Ok(new { id = bid.Id, amount = bid.Amount });
    }

    private Guid? GetCurrentUserId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);

        return Guid.TryParse(raw, out var id) ? id : null;
    }
}
