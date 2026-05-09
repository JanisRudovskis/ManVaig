using ManVaig.Api.Data;
using ManVaig.Api.Models.Dto;
using ManVaig.Api.Models.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ManVaig.Api.Controllers.V1;

[ApiController]
[Route("api/v1/public/stalls")]
public class PublicStallsController : ControllerBase
{
    private readonly AppDbContext _db;

    public PublicStallsController(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Browse public stalls (no auth required). Only stalls with at least one public item are returned.
    /// Supports pagination + ?q= text search across stall name, description, and owner display name.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Browse(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? q = null)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var query = _db.Stalls
            .Where(s => s.Visibility == StallVisibility.Public)
            .Where(s => s.Items.Any(i => i.Visibility == ItemVisibility.Public));

        if (!string.IsNullOrWhiteSpace(q))
        {
            var trimmed = q.Trim();
            if (trimmed.Length > 100) trimmed = trimmed.Substring(0, 100);
            var pattern = $"%{trimmed}%";
            query = query.Where(s =>
                EF.Functions.ILike(EF.Functions.Unaccent(s.Name), EF.Functions.Unaccent(pattern)) ||
                (s.Description != null && EF.Functions.ILike(EF.Functions.Unaccent(s.Description), EF.Functions.Unaccent(pattern))) ||
                (s.User.DisplayName != null && EF.Functions.ILike(EF.Functions.Unaccent(s.User.DisplayName), EF.Functions.Unaccent(pattern))));
        }

        var totalCount = await query.CountAsync();

        var stalls = await query
            .OrderByDescending(s => s.Items.Count(i => i.Visibility == ItemVisibility.Public))
            .ThenByDescending(s => s.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(s => new PublicStallResponse
            {
                Id = s.Id,
                Name = s.Name,
                Slug = s.Slug,
                Description = s.Description,
                ThumbnailUrl = s.ThumbnailUrl,
                HeaderImageUrl = s.HeaderImageUrl,
                BackgroundImageUrl = s.BackgroundImageUrl,
                AccentColor = s.AccentColor,
                ItemCount = s.Items.Count(i => i.Visibility == ItemVisibility.Public),
                PreviewImageUrls = s.Items
                    .Where(i => i.Visibility == ItemVisibility.Public)
                    .SelectMany(i => i.Images.Where(img => img.IsPrimary).Select(img => img.Url))
                    .Take(4)
                    .ToList(),
                Owner = new PublicStallOwnerDto
                {
                    DisplayName = s.User.DisplayName ?? "User",
                    AvatarUrl = s.User.AvatarUrl,
                    Location = s.User.Location
                }
            })
            .ToListAsync();

        return Ok(new PublicStallListResponse
        {
            Stalls = stalls,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        });
    }
}
