namespace ManVaig.Api.Models.Enums;

public enum NotificationType
{
    NewBid = 0,
    AuctionEnded = 1,
    BidAccepted = 2,
    NewItemFromFollowed = 3,
    BidDenied = 4,
    ItemDeleted = 5,
    BidWon = 6,
    InstantBuyRequested = 7,
    InstantBuyAccepted = 8,
    InstantBuyDeclined = 9,
    AuctionReopened = 10,
    AuctionClosed = 11,
}
