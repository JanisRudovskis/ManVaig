using System.ComponentModel.DataAnnotations;

namespace ManVaig.Api.Models.Dto;

public class StartConversationRequest
{
    [Required]
    public Guid ParticipantId { get; set; }
}

public class SendMessageRequest
{
    [Required, MaxLength(2000)]
    public string Text { get; set; } = "";
}

public class ConversationListItem
{
    public Guid Id { get; set; }
    public Guid OtherUserId { get; set; }
    public string OtherUserDisplayName { get; set; } = "";
    public string? OtherUserAvatarUrl { get; set; }
    public string? LastMessageText { get; set; }
    public DateTime? LastMessageAt { get; set; }
    public int UnreadCount { get; set; }
}

public class MessageResponse
{
    public Guid Id { get; set; }
    public Guid SenderId { get; set; }
    public string SenderDisplayName { get; set; } = "";
    public string? SenderAvatarUrl { get; set; }
    public string Text { get; set; } = "";
    public bool IsRead { get; set; }
    public bool IsOwnMessage { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ConversationResponse
{
    public Guid Id { get; set; }
    public Guid OtherUserId { get; set; }
    public string OtherUserDisplayName { get; set; } = "";
    public string? OtherUserAvatarUrl { get; set; }
    public List<MessageResponse> Messages { get; set; } = new();
    public int TotalMessages { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}

public class InboxResponse
{
    public List<ConversationListItem> Conversations { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}
