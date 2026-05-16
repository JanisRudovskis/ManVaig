namespace ManVaig.Api.Services;

public interface INotificationService
{
    Task NotifyNewBid(Guid sellerId, Guid bidderId, Guid itemId, Guid bidId);
    /// <summary>Notify seller + all subscribers (excluding the bidder) about a new bid.</summary>
    Task NotifyNewBidToSubscribers(Guid sellerId, Guid bidderId, Guid itemId, Guid bidId);
    Task NotifyAuctionEnded(Guid sellerId, Guid itemId);
    /// <summary>Notify all subscribers that the auction ended.</summary>
    Task NotifyAuctionEndedToSubscribers(Guid itemId, Guid sellerId);
    Task NotifyBidAccepted(Guid bidderId, Guid itemId, Guid bidId);
    Task NotifyBidWon(Guid winnerId, Guid itemId, Guid bidId);
    Task NotifyNewItemFromFollowed(Guid sellerId, Guid itemId);
    Task NotifyBidDenied(Guid bidderId, Guid itemId, Guid bidId, string reason);
    Task NotifyItemDeleted(Guid itemId, Guid sellerId, string itemTitle);
}
