using ManVaig.Api.Data;
using ManVaig.Api.Hubs;
using ManVaig.Api.Models;
using ManVaig.Api.Models.Enums;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace ManVaig.Api.Services;

public class NotificationService : INotificationService
{
    private readonly AppDbContext _db;
    private readonly IHubContext<AppHub> _hubContext;

    public NotificationService(AppDbContext db, IHubContext<AppHub> hubContext)
    {
        _db = db;
        _hubContext = hubContext;
    }

    public async Task NotifyNewBid(Guid sellerId, Guid bidderId, Guid itemId, Guid bidId)
    {
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            UserId = sellerId,
            Type = NotificationType.NewBid,
            ActorId = bidderId,
            ItemId = itemId,
            BidId = bidId,
        };

        _db.Notifications.Add(notification);
        await _db.SaveChangesAsync();
        await SendNotificationCount(sellerId);
    }

    public async Task NotifyNewBidToSubscribers(Guid sellerId, Guid bidderId, Guid itemId, Guid bidId)
    {
        // Get explicitly subscribed users (IsActive = true), excluding the bidder
        var subscriberIds = await _db.ItemSubscriptions
            .Where(s => s.ItemId == itemId && s.IsActive && s.UserId != bidderId)
            .Select(s => s.UserId)
            .ToListAsync();

        // Seller is subscribed by default (if no row exists, they haven't explicitly opted out)
        var sellerHasRow = await _db.ItemSubscriptions
            .AnyAsync(s => s.ItemId == itemId && s.UserId == sellerId);
        if (!sellerHasRow && sellerId != bidderId)
        {
            subscriberIds.Add(sellerId);
        }

        foreach (var subscriberId in subscriberIds)
        {
            _db.Notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                UserId = subscriberId,
                Type = NotificationType.NewBid,
                ActorId = bidderId,
                ItemId = itemId,
                BidId = bidId,
            });
        }

        if (subscriberIds.Count > 0)
        {
            await _db.SaveChangesAsync();
            foreach (var subscriberId in subscriberIds)
                await SendNotificationCount(subscriberId);
        }
    }

    public async Task NotifyAuctionEnded(Guid sellerId, Guid itemId)
    {
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            UserId = sellerId,
            Type = NotificationType.AuctionEnded,
            ItemId = itemId,
        };

        _db.Notifications.Add(notification);
        await _db.SaveChangesAsync();
        await SendNotificationCount(sellerId);
    }

    public async Task NotifyBidAccepted(Guid bidderId, Guid itemId, Guid bidId)
    {
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            UserId = bidderId,
            Type = NotificationType.BidAccepted,
            ItemId = itemId,
            BidId = bidId,
        };

        _db.Notifications.Add(notification);
        await _db.SaveChangesAsync();
        await SendNotificationCount(bidderId);
    }

    public async Task NotifyNewItemFromFollowed(Guid sellerId, Guid itemId)
    {
        var followerIds = await _db.UserFollows
            .AsNoTracking()
            .Where(uf => uf.FolloweeId == sellerId)
            .Select(uf => uf.FollowerId)
            .ToListAsync();

        if (followerIds.Count == 0) return;

        var oneHourAgo = DateTime.UtcNow.AddHours(-1);
        var newNotifications = new List<Notification>();

        foreach (var followerId in followerIds)
        {
            // Throttle: check for existing unread notification from same actor within 1 hour
            var existing = await _db.Notifications
                .FirstOrDefaultAsync(n =>
                    n.UserId == followerId
                    && n.Type == NotificationType.NewItemFromFollowed
                    && n.ActorId == sellerId
                    && !n.IsRead
                    && n.CreatedAt >= oneHourAgo);

            if (existing != null)
            {
                existing.GroupCount++;
                existing.ItemId = itemId;
                existing.CreatedAt = DateTime.UtcNow;
            }
            else
            {
                newNotifications.Add(new Notification
                {
                    Id = Guid.NewGuid(),
                    UserId = followerId,
                    Type = NotificationType.NewItemFromFollowed,
                    ActorId = sellerId,
                    ItemId = itemId,
                });
            }
        }

        if (newNotifications.Count > 0)
            _db.Notifications.AddRange(newNotifications);

        await _db.SaveChangesAsync();

        // Broadcast count to all affected followers
        foreach (var followerId in followerIds)
        {
            await SendNotificationCount(followerId);
        }
    }

    public async Task NotifyAuctionEndedToSubscribers(Guid itemId, Guid sellerId)
    {
        // Get explicitly subscribed users (IsActive = true)
        var subscriberIds = await _db.ItemSubscriptions
            .Where(s => s.ItemId == itemId && s.IsActive)
            .Select(s => s.UserId)
            .ToListAsync();

        // Seller is subscribed by default (if no row exists)
        var sellerHasRow = await _db.ItemSubscriptions
            .AnyAsync(s => s.ItemId == itemId && s.UserId == sellerId);
        if (!sellerHasRow && !subscriberIds.Contains(sellerId))
        {
            subscriberIds.Add(sellerId);
        }

        foreach (var subscriberId in subscriberIds)
        {
            _db.Notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                UserId = subscriberId,
                Type = NotificationType.AuctionEnded,
                ItemId = itemId,
            });
        }

        if (subscriberIds.Count > 0)
        {
            await _db.SaveChangesAsync();
            foreach (var subscriberId in subscriberIds)
                await SendNotificationCount(subscriberId);
        }
    }

    public async Task NotifyBidWon(Guid winnerId, Guid itemId, Guid bidId)
    {
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            UserId = winnerId,
            Type = NotificationType.BidWon,
            ItemId = itemId,
            BidId = bidId,
        };

        _db.Notifications.Add(notification);
        await _db.SaveChangesAsync();
        await SendNotificationCount(winnerId);
    }

    public async Task NotifyItemDeleted(Guid itemId, Guid sellerId, string itemTitle)
    {
        // Notify active subscribers (excluding seller — they're the one deleting)
        var subscriberIds = await _db.ItemSubscriptions
            .Where(s => s.ItemId == itemId && s.IsActive && s.UserId != sellerId)
            .Select(s => s.UserId)
            .ToListAsync();

        foreach (var subscriberId in subscriberIds)
        {
            _db.Notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                UserId = subscriberId,
                Type = NotificationType.ItemDeleted,
                ItemId = itemId,
                // ActorId = sellerId — item will be deleted, so ItemId FK will be null via cascade
                // We store the title in DenyReason field as a generic "detail" field
                // (alternatively we could add a dedicated field, but this works for now)
                DenyReason = itemTitle,
            });
        }

        if (subscriberIds.Count > 0)
        {
            await _db.SaveChangesAsync();
            foreach (var subscriberId in subscriberIds)
                await SendNotificationCount(subscriberId);
        }
    }

    public async Task NotifyBidDenied(Guid bidderId, Guid itemId, Guid bidId, string reason)
    {
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            UserId = bidderId,
            Type = NotificationType.BidDenied,
            ItemId = itemId,
            BidId = bidId,
            DenyReason = reason,
        };

        _db.Notifications.Add(notification);
        await _db.SaveChangesAsync();
        await SendNotificationCount(bidderId);
    }

    public async Task NotifyInstantBuyRequested(Guid sellerId, Guid buyerId, Guid itemId)
    {
        _db.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = sellerId,
            Type = NotificationType.InstantBuyRequested,
            ActorId = buyerId,
            ItemId = itemId,
        });
        await _db.SaveChangesAsync();
        await SendNotificationCount(sellerId);
    }

    public async Task NotifyInstantBuyAccepted(Guid buyerId, Guid itemId)
    {
        _db.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = buyerId,
            Type = NotificationType.InstantBuyAccepted,
            ItemId = itemId,
        });
        await _db.SaveChangesAsync();
        await SendNotificationCount(buyerId);
    }

    public async Task NotifyAuctionReopenedToSubscribers(Guid itemId, Guid sellerId)
    {
        var subscriberIds = await _db.ItemSubscriptions
            .Where(s => s.ItemId == itemId && s.IsActive && s.UserId != sellerId)
            .Select(s => s.UserId)
            .ToListAsync();

        // Seller is subscribed by default
        var sellerHasRow = await _db.ItemSubscriptions
            .AnyAsync(s => s.ItemId == itemId && s.UserId == sellerId);
        // Don't notify seller — they're the one reopening

        foreach (var subscriberId in subscriberIds)
        {
            _db.Notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                UserId = subscriberId,
                Type = NotificationType.AuctionReopened,
                ItemId = itemId,
            });
        }

        if (subscriberIds.Count > 0)
        {
            await _db.SaveChangesAsync();
            foreach (var subscriberId in subscriberIds)
                await SendNotificationCount(subscriberId);
        }
    }

    public async Task NotifyAuctionClosedToSubscribers(Guid itemId, Guid sellerId)
    {
        var subscriberIds = await _db.ItemSubscriptions
            .Where(s => s.ItemId == itemId && s.IsActive && s.UserId != sellerId)
            .Select(s => s.UserId)
            .ToListAsync();

        foreach (var subscriberId in subscriberIds)
        {
            _db.Notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                UserId = subscriberId,
                Type = NotificationType.AuctionClosed,
                ItemId = itemId,
            });
        }

        if (subscriberIds.Count > 0)
        {
            await _db.SaveChangesAsync();
            foreach (var subscriberId in subscriberIds)
                await SendNotificationCount(subscriberId);
        }
    }

    public async Task NotifyInstantBuyDeclined(Guid buyerId, Guid itemId)
    {
        _db.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = buyerId,
            Type = NotificationType.InstantBuyDeclined,
            ItemId = itemId,
        });
        await _db.SaveChangesAsync();
        await SendNotificationCount(buyerId);
    }

    private async Task SendNotificationCount(Guid userId)
    {
        var count = await _db.Notifications.CountAsync(n =>
            n.UserId == userId && !n.IsRead);

        await _hubContext.Clients.Group($"user_{userId}")
            .SendAsync("NotificationCountChanged", count);
    }
}
