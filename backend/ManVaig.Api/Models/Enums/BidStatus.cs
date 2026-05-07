namespace ManVaig.Api.Models.Enums;

public enum BidStatus
{
    Active = 0,
    Accepted = 1,   // Seller chose this bid — in deal negotiation
    Completed = 2,  // Deal done, item sold
    Denied = 3,     // Seller rejected (doesn't count for minimum bid)
    Failed = 4,     // Was accepted, deal fell through — bidding reopens
    Expired = 5     // Legacy migration compatibility
}
