namespace ManVaig.Api.Models.Dto;

public class PublicUserCardDto
{
    public string DisplayName { get; set; } = "";
    public string? AvatarUrl { get; set; }
    public DateTime MemberSince { get; set; }
    public DateTime? LastSeenAt { get; set; }
    public bool HasWhatsApp { get; set; }
    public bool HasTelegram { get; set; }
    public bool HasPhone { get; set; }
    public bool HasEmail { get; set; }
}

public class PublicUserListResponse
{
    public List<PublicUserCardDto> Users { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}
