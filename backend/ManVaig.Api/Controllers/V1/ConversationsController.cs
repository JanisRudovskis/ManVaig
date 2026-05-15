using System.Collections.Concurrent;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using ManVaig.Api.Data;
using ManVaig.Api.Hubs;
using ManVaig.Api.Models;
using ManVaig.Api.Models.Dto;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace ManVaig.Api.Controllers.V1;

[ApiController]
[Route("api/v1/conversations")]
[Authorize]
public class ConversationsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<ChatHub> _hubContext;

    // Rate limiting: 20 messages per minute per user (sliding window)
    private static readonly ConcurrentDictionary<Guid, List<DateTime>> _messageRateLimits = new();

    public ConversationsController(AppDbContext db, IHubContext<ChatHub> hubContext)
    {
        _db = db;
        _hubContext = hubContext;
    }

    /// <summary>
    /// List user's conversations (inbox), sorted by last message time.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetConversations([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var query = _db.Conversations
            .Where(c => c.User1Id == userId.Value || c.User2Id == userId.Value)
            .OrderByDescending(c => c.LastMessageAt ?? c.CreatedAt);

        var totalCount = await query.CountAsync();

        var conversations = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new ConversationListItem
            {
                Id = c.Id,
                OtherUserId = c.User1Id == userId.Value ? c.User2Id : c.User1Id,
                OtherUserDisplayName = c.User1Id == userId.Value
                    ? (c.User2.DisplayName ?? "")
                    : (c.User1.DisplayName ?? ""),
                OtherUserAvatarUrl = c.User1Id == userId.Value
                    ? c.User2.AvatarUrl
                    : c.User1.AvatarUrl,
                LastMessageText = c.Messages
                    .OrderByDescending(m => m.CreatedAt)
                    .Select(m => m.Text)
                    .FirstOrDefault(),
                LastMessageAt = c.LastMessageAt,
                UnreadCount = c.Messages.Count(m => m.SenderId != userId.Value && !m.IsRead),
            })
            .ToListAsync();

        return Ok(new InboxResponse
        {
            Conversations = conversations,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
        });
    }

    /// <summary>
    /// Get messages for a conversation (paginated, newest first).
    /// </summary>
    [HttpGet("{id:guid}/messages")]
    public async Task<IActionResult> GetMessages(Guid id, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var conversation = await _db.Conversations
            .Include(c => c.User1)
            .Include(c => c.User2)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (conversation == null)
            return NotFound(new { error = "CONVERSATION_NOT_FOUND" });

        if (conversation.User1Id != userId.Value && conversation.User2Id != userId.Value)
            return NotFound(new { error = "CONVERSATION_NOT_FOUND" });

        var otherUser = conversation.User1Id == userId.Value ? conversation.User2 : conversation.User1;

        var query = _db.Messages
            .Where(m => m.ConversationId == id)
            .OrderByDescending(m => m.CreatedAt);

        var totalMessages = await query.CountAsync();

        var messages = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Include(m => m.Sender)
            .Select(m => new MessageResponse
            {
                Id = m.Id,
                SenderId = m.SenderId,
                SenderDisplayName = m.Sender.DisplayName ?? "",
                SenderAvatarUrl = m.Sender.AvatarUrl,
                Text = m.Text,
                IsRead = m.IsRead,
                IsOwnMessage = m.SenderId == userId.Value,
                CreatedAt = m.CreatedAt,
            })
            .ToListAsync();

        return Ok(new ConversationResponse
        {
            Id = conversation.Id,
            OtherUserId = otherUser.Id,
            OtherUserDisplayName = otherUser.DisplayName ?? "",
            OtherUserAvatarUrl = otherUser.AvatarUrl,
            Messages = messages,
            TotalMessages = totalMessages,
            Page = page,
            PageSize = pageSize,
        });
    }

    /// <summary>
    /// Start or get existing conversation with another user.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> StartConversation([FromBody] StartConversationRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        if (request.ParticipantId == userId.Value)
            return BadRequest(new { error = "CANNOT_MESSAGE_SELF" });

        var participant = await _db.Users.FirstOrDefaultAsync(u =>
            u.Id == request.ParticipantId && u.IsActive);

        if (participant == null)
            return NotFound(new { error = "USER_NOT_FOUND" });

        if (!participant.IsProfilePublic)
            return BadRequest(new { error = "USER_PROFILE_PRIVATE" });

        // Normalize user order for deduplication
        var (u1, u2) = userId.Value.CompareTo(request.ParticipantId) < 0
            ? (userId.Value, request.ParticipantId)
            : (request.ParticipantId, userId.Value);

        // Check for existing conversation
        var existing = await _db.Conversations
            .FirstOrDefaultAsync(c => c.User1Id == u1 && c.User2Id == u2);

        if (existing != null)
            return Ok(new { id = existing.Id });

        var conversation = new Conversation
        {
            Id = Guid.NewGuid(),
            User1Id = u1,
            User2Id = u2,
        };

        try
        {
            _db.Conversations.Add(conversation);
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Race condition: another request already created -- find and return existing
            var raceExisting = await _db.Conversations
                .FirstOrDefaultAsync(c => c.User1Id == u1 && c.User2Id == u2);
            if (raceExisting != null)
                return Ok(new { id = raceExisting.Id });
            throw;
        }

        return Ok(new { id = conversation.Id });
    }

    /// <summary>
    /// Send a message in a conversation. Rate limited: 20 messages per minute.
    /// </summary>
    [HttpPost("{id:guid}/messages")]
    public async Task<IActionResult> SendMessage(Guid id, [FromBody] SendMessageRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        if (string.IsNullOrWhiteSpace(request.Text))
            return BadRequest(new { error = "MESSAGE_EMPTY" });

        if (request.Text.Length > 2000)
            return BadRequest(new { error = "MESSAGE_TOO_LONG" });

        // Rate limiting: 20 messages per minute sliding window
        var now = DateTime.UtcNow;
        var timestamps = _messageRateLimits.GetOrAdd(userId.Value, _ => new List<DateTime>());
        lock (timestamps)
        {
            timestamps.RemoveAll(t => (now - t).TotalSeconds > 60);
            if (timestamps.Count >= 20)
                return StatusCode(429, new { error = "RATE_LIMITED", retryAfter = 60 });
            timestamps.Add(now);
        }

        // Periodic cleanup: remove entries for inactive users (empty lists after pruning)
        if (now.Second == 0) // Run cleanup roughly once per minute
        {
            foreach (var key in _messageRateLimits.Keys)
            {
                if (_messageRateLimits.TryGetValue(key, out var list))
                {
                    lock (list)
                    {
                        list.RemoveAll(t => (now - t).TotalSeconds > 60);
                        if (list.Count == 0)
                            _messageRateLimits.TryRemove(key, out _);
                    }
                }
            }
        }

        var conversation = await _db.Conversations
            .FirstOrDefaultAsync(c => c.Id == id);

        if (conversation == null)
            return NotFound(new { error = "CONVERSATION_NOT_FOUND" });

        if (conversation.User1Id != userId.Value && conversation.User2Id != userId.Value)
            return NotFound(new { error = "CONVERSATION_NOT_FOUND" });

        var sender = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId.Value);
        if (sender == null) return Unauthorized();

        var message = new Message
        {
            Id = Guid.NewGuid(),
            ConversationId = id,
            SenderId = userId.Value,
            Text = request.Text.Trim(),
        };

        _db.Messages.Add(message);
        conversation.LastMessageAt = message.CreatedAt;
        await _db.SaveChangesAsync();

        var response = new MessageResponse
        {
            Id = message.Id,
            SenderId = message.SenderId,
            SenderDisplayName = sender.DisplayName ?? "",
            SenderAvatarUrl = sender.AvatarUrl,
            Text = message.Text,
            IsRead = false,
            IsOwnMessage = false, // Will be adjusted client-side
            CreatedAt = message.CreatedAt,
        };

        // Broadcast to conversation group
        await _hubContext.Clients.Group($"conversation_{id}")
            .SendAsync("ReceiveMessage", response);

        // Notify the other user's personal group for unread count update
        var otherUserId = conversation.User1Id == userId.Value
            ? conversation.User2Id : conversation.User1Id;

        var unreadCount = await _db.Messages.CountAsync(m =>
            (m.Conversation.User1Id == otherUserId || m.Conversation.User2Id == otherUserId)
            && m.SenderId != otherUserId
            && !m.IsRead);

        await _hubContext.Clients.Group($"user_{otherUserId}")
            .SendAsync("UnreadCountChanged", unreadCount);

        return Ok(response);
    }

    /// <summary>
    /// Mark all messages in a conversation as read (messages from the other user).
    /// </summary>
    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> MarkAsRead(Guid id)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var conversation = await _db.Conversations
            .FirstOrDefaultAsync(c => c.Id == id);

        if (conversation == null)
            return NotFound(new { error = "CONVERSATION_NOT_FOUND" });

        if (conversation.User1Id != userId.Value && conversation.User2Id != userId.Value)
            return NotFound(new { error = "CONVERSATION_NOT_FOUND" });

        var unreadMessages = await _db.Messages
            .Where(m => m.ConversationId == id && m.SenderId != userId.Value && !m.IsRead)
            .ToListAsync();

        foreach (var msg in unreadMessages)
            msg.IsRead = true;

        await _db.SaveChangesAsync();

        // Notify the other user that messages were read
        var otherUserId = conversation.User1Id == userId.Value
            ? conversation.User2Id : conversation.User1Id;

        await _hubContext.Clients.Group($"conversation_{id}")
            .SendAsync("MessagesRead", id, userId.Value);

        // Update the current user's unread count
        var myUnreadCount = await _db.Messages.CountAsync(m =>
            (m.Conversation.User1Id == userId.Value || m.Conversation.User2Id == userId.Value)
            && m.SenderId != userId.Value
            && !m.IsRead);

        await _hubContext.Clients.Group($"user_{userId.Value}")
            .SendAsync("UnreadCountChanged", myUnreadCount);

        return Ok(new { read = unreadMessages.Count });
    }

    /// <summary>
    /// Get total unread message count for the current user. For top bar badge.
    /// </summary>
    [HttpGet("unread-count")]
    public async Task<IActionResult> GetUnreadCount()
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var count = await _db.Messages.CountAsync(m =>
            (m.Conversation.User1Id == userId.Value || m.Conversation.User2Id == userId.Value)
            && m.SenderId != userId.Value
            && !m.IsRead);

        return Ok(new { count });
    }

    private Guid? GetCurrentUserId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return Guid.TryParse(raw, out var id) ? id : null;
    }
}
