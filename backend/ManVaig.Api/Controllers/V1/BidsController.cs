using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using ManVaig.Api.Data;
using ManVaig.Api.Models;
using ManVaig.Api.Models.Dto;
using ManVaig.Api.Models.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ManVaig.Api.Controllers.V1;

[ApiController]
[Route("api/v1/items/{itemId:guid}/bids")]
[Authorize]
public class BidsController : ControllerBase
{
    private readonly AppDbContext _db;

    public BidsController(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Get bid history for an item (owner only).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetBids(Guid itemId)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var item = await _db.Items.FirstOrDefaultAsync(i => i.Id == itemId && i.UserId == userId.Value);
        if (item == null) return NotFound(new { error = "ITEM_NOT_FOUND" });
        if (!item.AcceptOffers) return BadRequest(new { error = "OFFERS_NOT_ACCEPTED" });

        var bids = await _db.Bids
            .Where(b => b.ItemId == itemId)
            .OrderByDescending(b => b.Amount)
            .Include(b => b.User)
            .ToListAsync();

        var auctionEnded = item.EndDate.HasValue && item.EndDate.Value <= DateTime.UtcNow;
        var winnerExpiresAt = auctionEnded && item.EndDate.HasValue
            ? item.EndDate.Value.AddHours(24)
            : (DateTime?)null;

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

        // Find the winning bid (highest amount, status Won or first Active if not yet assigned)
        var winningBid = bids.FirstOrDefault(b => b.Status == BidStatus.Won)
            ?? (auctionEnded ? bids.FirstOrDefault() : null);

        var response = new BidListResponse
        {
            TotalBids = bids.Count,
            HighestBid = bids.FirstOrDefault()?.Amount,
            AuctionEnded = auctionEnded,
            WinnerExpiresAt = winnerExpiresAt,
            Bids = bids.Select(b =>
            {
                var isWinner = winningBid != null && b.Id == winningBid.Id;
                var revealIdentity = auctionEnded && isWinner;

                return new BidResponse
                {
                    Id = b.Id,
                    BidderLabel = $"Bidder #{bidderLabels[b.UserId]}",
                    BidderName = revealIdentity ? b.User.DisplayName : null,
                    BidderContact = revealIdentity ? b.User.Email : null,
                    Amount = b.Amount,
                    Status = b.Status.ToString(),
                    IsWinner = isWinner,
                    CreatedAt = b.CreatedAt
                };
            }).ToList()
        };

        return Ok(response);
    }

    /// <summary>
    /// Place a bid/offer on an item that accepts offers.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> PlaceBid(Guid itemId, [FromBody] PlaceBidRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var item = await _db.Items.FirstOrDefaultAsync(i => i.Id == itemId);
        if (item == null) return NotFound(new { error = "ITEM_NOT_FOUND" });

        // Visibility check — don't allow bids on private items
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

        // Get current highest bid
        var highestBid = await _db.Bids
            .Where(b => b.ItemId == itemId)
            .OrderByDescending(b => b.Amount)
            .FirstOrDefaultAsync();

        var currentHighest = highestBid?.Amount ?? 0;

        // Must be higher than current highest (ascending offers)
        if (request.Amount <= currentHighest)
            return BadRequest(new { error = "BID_TOO_LOW" });

        // Must be >= min offer price (floor)
        if (item.MinOfferPrice.HasValue && request.Amount < item.MinOfferPrice.Value)
            return BadRequest(new { error = "BID_BELOW_STARTING" });

        // Must respect offer step
        if (item.OfferStep.HasValue && item.OfferStep.Value > 0 && highestBid != null)
        {
            var minNext = currentHighest + item.OfferStep.Value;
            if (request.Amount < minNext)
                return BadRequest(new { error = "BID_STEP_TOO_SMALL" });
        }

        // Create bid
        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            ItemId = itemId,
            UserId = userId.Value,
            Amount = request.Amount,
            Status = BidStatus.Active,
            CreatedAt = DateTime.UtcNow
        };

        _db.Bids.Add(bid);

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

        return Ok(new { id = bid.Id, amount = bid.Amount, antiSnipe });
    }

    /// <summary>
    /// Assign the next highest bidder as winner (seller only, after winner expires).
    /// Only applicable to timed items.
    /// </summary>
    [HttpPost("assign-next")]
    public async Task<IActionResult> AssignNextWinner(Guid itemId)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var item = await _db.Items.FirstOrDefaultAsync(i => i.Id == itemId && i.UserId == userId.Value);
        if (item == null) return NotFound(new { error = "ITEM_NOT_FOUND" });

        if (!item.AcceptOffers)
            return BadRequest(new { error = "OFFERS_NOT_ACCEPTED" });

        // Must be a timed item
        if (!item.EndDate.HasValue)
            return BadRequest(new { error = "NOT_TIMED_ITEM" });

        // Must have ended
        if (item.EndDate.Value > DateTime.UtcNow)
            return BadRequest(new { error = "OFFERS_NOT_ENDED" });

        // 24h must have passed since end
        var expiryTime = item.EndDate.Value.AddHours(24);
        if (DateTime.UtcNow < expiryTime)
            return BadRequest(new { error = "WINNER_NOT_EXPIRED" });

        var bids = await _db.Bids
            .Where(b => b.ItemId == itemId)
            .OrderByDescending(b => b.Amount)
            .ToListAsync();

        // Find current winner and mark as expired
        var currentWinner = bids.FirstOrDefault(b => b.Status == BidStatus.Won);
        if (currentWinner != null)
        {
            currentWinner.Status = BidStatus.Expired;
        }
        else
        {
            // No explicit winner yet — mark highest as expired
            var highest = bids.FirstOrDefault(b => b.Status == BidStatus.Active);
            if (highest != null)
                highest.Status = BidStatus.Expired;
        }

        // Find next highest active bid (from a different user than expired ones)
        var expiredUserIds = bids.Where(b => b.Status == BidStatus.Expired).Select(b => b.UserId).ToHashSet();
        var nextWinner = bids.FirstOrDefault(b => b.Status == BidStatus.Active && !expiredUserIds.Contains(b.UserId));

        if (nextWinner == null)
            return BadRequest(new { error = "NO_MORE_BIDDERS" });

        nextWinner.Status = BidStatus.Won;

        // Reset the 24h timer: update EndDate to now so the new winner gets 24h
        item.EndDate = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc);

        await _db.SaveChangesAsync();

        return Ok(new { winnerId = nextWinner.Id, amount = nextWinner.Amount });
    }

    private Guid? GetCurrentUserId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);

        return Guid.TryParse(raw, out var id) ? id : null;
    }
}
