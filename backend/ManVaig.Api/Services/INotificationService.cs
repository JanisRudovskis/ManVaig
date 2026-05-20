namespace ManVaig.Api.Services;

public interface INotificationService
{
    /// <summary>Notify the seller about a new bid.</summary>
    Task NotifyNewBidToSeller(Guid sellerId, Guid bidderId, Guid itemId, Guid bidId);
    /// <summary>Notify all subscribers that the auction ended.</summary>
    Task NotifyAuctionEndedToSubscribers(Guid itemId, Guid sellerId);
    Task NotifyBidWon(Guid winnerId, Guid itemId, Guid bidId);
    Task NotifyNewItemFromFollowed(Guid sellerId, Guid itemId);
    Task NotifyBidDenied(Guid bidderId, Guid itemId, Guid bidId, string reason);
    Task NotifyItemDeleted(Guid itemId, Guid sellerId, string itemTitle);
    Task NotifyInstantBuyRequested(Guid sellerId, Guid buyerId, Guid itemId);
    Task NotifyInstantBuyAccepted(Guid buyerId, Guid itemId);
    Task NotifyInstantBuyDeclined(Guid buyerId, Guid itemId);
    Task NotifyAuctionClosedToSubscribers(Guid itemId, Guid sellerId);
    Task NotifyOutbid(Guid previousTopBidderId, Guid newBidderId, Guid itemId, Guid newBidId);
}
