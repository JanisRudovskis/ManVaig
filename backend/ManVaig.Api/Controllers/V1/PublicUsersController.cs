using ManVaig.Api.Data;
using ManVaig.Api.Models;
using ManVaig.Api.Models.Dto;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ManVaig.Api.Controllers.V1;

[ApiController]
[Route("api/v1/public/users")]
public class PublicUsersController : ControllerBase
{
    private readonly AppDbContext _db;

    public PublicUsersController(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Browse public users (no auth required). Anonymous viewers only see active + public-profile users;
    /// authenticated viewers see all active users (public + private). Supports pagination + ?q= text
    /// search by display name. DisplayName regex excludes diacritics, so plain ILIKE is sufficient.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Browse(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? q = null)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var query = _db.Users.Where(u => u.IsActive);

        if (User.Identity?.IsAuthenticated != true)
            query = query.Where(u => u.IsProfilePublic);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var trimmed = q.Trim();
            if (trimmed.Length > 100) trimmed = trimmed.Substring(0, 100);
            var pattern = $"%{trimmed}%";
            query = query.Where(u => u.DisplayName != null && EF.Functions.ILike(u.DisplayName, pattern));
        }

        var totalCount = await query.CountAsync();

        var users = await query
            .OrderByDescending(u => u.LastSeenAt.HasValue)
            .ThenByDescending(u => u.LastSeenAt)
            .ThenByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new PublicUserCardDto
            {
                DisplayName = u.DisplayName ?? "",
                AvatarUrl = u.AvatarUrl,
                MemberSince = u.CreatedAt,
                LastSeenAt = u.LastSeenAt,
                HasEmail = (u.EnabledChannels & CommunicationChannels.ShowEmail) != 0 && u.EmailConfirmed,
                HasPhone = (u.EnabledChannels & CommunicationChannels.ShowPhone) != 0
                    && u.Phone != null && u.Phone != "",
                HasWhatsApp = (u.EnabledChannels & CommunicationChannels.ShowPhone) != 0
                    && (u.EnabledChannels & CommunicationChannels.WhatsApp) != 0
                    && u.Phone != null && u.Phone != "",
                HasTelegram = (u.EnabledChannels & CommunicationChannels.Telegram) != 0
                    && u.TelegramUsername != null && u.TelegramUsername != ""
            })
            .ToListAsync();

        return Ok(new PublicUserListResponse
        {
            Users = users,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        });
    }
}
