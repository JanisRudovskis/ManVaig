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

    private async Task SendNotificationCount(Guid userId)
    {
        var count = await _db.Notifications.CountAsync(n =>
            n.UserId == userId && !n.IsRead);

        await _hubContext.Clients.Group($"user_{userId}")
            .SendAsync("NotificationCountChanged", count);
    }
}
