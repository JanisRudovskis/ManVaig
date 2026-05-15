namespace ManVaig.Api.Models.Dto;

public class NotificationResponse
{
    public Guid Id { get; set; }
    public string Type { get; set; } = "";
    public string? ActorDisplayName { get; set; }
    public string? ActorAvatarUrl { get; set; }
    public Guid? ItemId { get; set; }
    public string? ItemTitle { get; set; }
    public string? ItemImageUrl { get; set; }
    public Guid? BidId { get; set; }
    public decimal? BidAmount { get; set; }
    public bool IsRead { get; set; }
    public int GroupCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class NotificationListResponse
{
    public List<NotificationResponse> Notifications { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}
