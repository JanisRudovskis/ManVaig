using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using ManVaig.Api.Data;
using ManVaig.Api.Hubs;
using ManVaig.Api.Models.Dto;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace ManVaig.Api.Controllers.V1;

[ApiController]
[Route("api/v1/notifications")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<AppHub> _hubContext;

    public NotificationsController(AppDbContext db, IHubContext<AppHub> hubContext)
    {
        _db = db;
        _hubContext = hubContext;
    }

    /// <summary>
    /// Get recent notifications (paginated, newest first).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetNotifications([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var query = _db.Notifications
            .Where(n => n.UserId == userId.Value)
            .OrderByDescending(n => n.CreatedAt);

        var totalCount = await query.CountAsync();

        var notifications = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(n => new NotificationResponse
            {
                Id = n.Id,
                Type = n.Type.ToString(),
                ActorDisplayName = n.Actor != null ? n.Actor.DisplayName : null,
                ActorAvatarUrl = n.Actor != null ? n.Actor.AvatarUrl : null,
                ItemId = n.ItemId,
                ItemTitle = n.Item != null ? n.Item.Title : null,
                ItemImageUrl = n.Item != null
                    ? n.Item.Images.Where(img => img.IsPrimary).Select(img => img.Url).FirstOrDefault()
                      ?? n.Item.Images.OrderBy(img => img.SortOrder).Select(img => img.Url).FirstOrDefault()
                    : null,
                BidId = n.BidId,
                BidAmount = n.Bid != null ? (decimal?)n.Bid.Amount : null,
                DenyReason = n.DenyReason,
                DenyDetail = n.Bid != null ? n.Bid.DenyDetail : null,
                IsRead = n.IsRead,
                GroupCount = n.GroupCount,
                CreatedAt = n.CreatedAt,
            })
            .ToListAsync();

        return Ok(new NotificationListResponse
        {
            Notifications = notifications,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
        });
    }

    /// <summary>
    /// Mark all notifications as read (called when dropdown opens).
    /// </summary>
    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllRead()
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var unread = await _db.Notifications
            .Where(n => n.UserId == userId.Value && !n.IsRead)
            .ToListAsync();

        foreach (var n in unread)
            n.IsRead = true;

        await _db.SaveChangesAsync();

        await _hubContext.Clients.Group($"user_{userId.Value}")
            .SendAsync("NotificationCountChanged", 0);

        return Ok(new { read = unread.Count });
    }

    /// <summary>
    /// Get unread notification count for bell badge.
    /// </summary>
    [HttpGet("unread-count")]
    public async Task<IActionResult> GetUnreadCount()
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var count = await _db.Notifications
            .CountAsync(n => n.UserId == userId.Value && !n.IsRead);

        return Ok(new { count });
    }

    private Guid? GetCurrentUserId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return Guid.TryParse(raw, out var id) ? id : null;
    }
}
