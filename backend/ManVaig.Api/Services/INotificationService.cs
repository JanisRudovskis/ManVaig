namespace ManVaig.Api.Services;

public interface INotificationService
{
    Task NotifyNewBid(Guid sellerId, Guid bidderId, Guid itemId, Guid bidId);
    Task NotifyAuctionEnded(Guid sellerId, Guid itemId);
    Task NotifyBidAccepted(Guid bidderId, Guid itemId, Guid bidId);
    Task NotifyNewItemFromFollowed(Guid sellerId, Guid itemId);
    Task NotifyBidDenied(Guid bidderId, Guid itemId, Guid bidId, string reason);
}
