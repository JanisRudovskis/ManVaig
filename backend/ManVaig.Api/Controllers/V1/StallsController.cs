using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.RegularExpressions;
using ManVaig.Api.Data;
using ManVaig.Api.Models;
using ManVaig.Api.Models.Dto;
using ManVaig.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ManVaig.Api.Controllers.V1;

[ApiController]
[Route("api/v1/stalls")]
[Authorize]
public class StallsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IImageService _imageService;

    public StallsController(AppDbContext db, IImageService imageService)
    {
        _db = db;
        _imageService = imageService;
    }

    /// <summary>
    /// List current user's stalls with item counts and preview images.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetMyStalls()
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var user = await _db.Users.FindAsync(userId.Value);
        if (user == null) return Unauthorized();

        var stalls = await _db.Stalls
            .Where(s => s.UserId == userId.Value)
            .OrderBy(s => s.SortOrder)
            .ThenBy(s => s.CreatedAt)
            .Select(s => new StallResponse
            {
                Id = s.Id,
                Name = s.Name,
                Slug = s.Slug,
                Description = s.Description,
                ThumbnailUrl = s.ThumbnailUrl,
                HeaderImageUrl = s.HeaderImageUrl,
                BackgroundImageUrl = s.BackgroundImageUrl,
                AccentColor = s.AccentColor,
                SortOrder = s.SortOrder,
                IsDefault = s.IsDefault,
                ItemCount = s.Items.Count,
                PreviewImageUrls = s.Items
                    .SelectMany(i => i.Images.Where(img => img.IsPrimary).Select(img => img.Url))
                    .Take(4)
                    .ToList(),
                FeaturedItemIds = s.FeaturedItems
                    .OrderBy(f => f.SortOrder)
                    .Select(f => f.ItemId)
                    .ToList(),
                CreatedAt = s.CreatedAt,
                UpdatedAt = s.UpdatedAt
            })
            .ToListAsync();

        var totalItemCount = await _db.Items.CountAsync(i => i.UserId == userId.Value);

        return Ok(new StallListResponse
        {
            Stalls = stalls,
            TotalItemCount = totalItemCount,
            MaxItems = user.MaxItems
        });
    }

    /// <summary>
    /// Get a single stall by ID (owner only).
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetStall(Guid id)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var stall = await _db.Stalls
            .Where(s => s.Id == id && s.UserId == userId.Value)
            .Select(s => new StallResponse
            {
                Id = s.Id,
                Name = s.Name,
                Slug = s.Slug,
                Description = s.Description,
                ThumbnailUrl = s.ThumbnailUrl,
                HeaderImageUrl = s.HeaderImageUrl,
                BackgroundImageUrl = s.BackgroundImageUrl,
                AccentColor = s.AccentColor,
                SortOrder = s.SortOrder,
                IsDefault = s.IsDefault,
                ItemCount = s.Items.Count,
                PreviewImageUrls = s.Items
                    .SelectMany(i => i.Images.Where(img => img.IsPrimary).Select(img => img.Url))
                    .Take(4)
                    .ToList(),
                FeaturedItemIds = s.FeaturedItems
                    .OrderBy(f => f.SortOrder)
                    .Select(f => f.ItemId)
                    .ToList(),
                CreatedAt = s.CreatedAt,
                UpdatedAt = s.UpdatedAt
            })
            .FirstOrDefaultAsync();

        if (stall == null) return NotFound(new { error = "Stall not found." });

        return Ok(stall);
    }

    /// <summary>
    /// Create a new stall.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateStall([FromBody] CreateStallRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var name = request.Name.Trim();
        if (name.Length < 3 || name.Length > 50)
            return BadRequest(new { error = "NAME_LENGTH" });

        // Validate accent color format
        if (request.AccentColor != null && !Regex.IsMatch(request.AccentColor, @"^#[0-9a-fA-F]{6}$"))
            return BadRequest(new { error = "INVALID_COLOR" });

        var slug = GenerateSlug(name);

        // Ensure slug is unique per user
        slug = await EnsureUniqueSlug(userId.Value, slug);

        var stall = new Stall
        {
            Id = Guid.NewGuid(),
            UserId = userId.Value,
            Name = name,
            Slug = slug,
            Description = request.Description?.Trim(),
            AccentColor = request.AccentColor,
            SortOrder = await _db.Stalls.CountAsync(s => s.UserId == userId.Value),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.Stalls.Add(stall);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetStall), new { id = stall.Id }, new StallResponse
        {
            Id = stall.Id,
            Name = stall.Name,
            Slug = stall.Slug,
            Description = stall.Description,
            AccentColor = stall.AccentColor,
            SortOrder = stall.SortOrder,
            IsDefault = stall.IsDefault,
            ItemCount = 0,
            PreviewImageUrls = new(),
            FeaturedItemIds = new(),
            CreatedAt = stall.CreatedAt,
            UpdatedAt = stall.UpdatedAt
        });
    }

    /// <summary>
    /// Update stall details.
    /// </summary>
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateStall(Guid id, [FromBody] UpdateStallRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var stall = await _db.Stalls.FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId.Value);
        if (stall == null) return NotFound(new { error = "Stall not found." });

        if (request.Name != null)
        {
            var name = request.Name.Trim();
            if (name.Length < 3 || name.Length > 50)
                return BadRequest(new { error = "NAME_LENGTH" });
            stall.Name = name;
        }

        if (request.Slug != null)
        {
            var slug = GenerateSlug(request.Slug);
            if (slug.Length < 3)
                return BadRequest(new { error = "SLUG_LENGTH" });

            // Check uniqueness (excluding current stall)
            var slugTaken = await _db.Stalls.AnyAsync(
                s => s.UserId == userId.Value && s.Slug == slug && s.Id != id);
            if (slugTaken)
                return BadRequest(new { error = "SLUG_TAKEN" });

            stall.Slug = slug;
        }

        if (request.Description != null)
            stall.Description = request.Description.Trim();

        if (request.AccentColor != null)
        {
            if (request.AccentColor == "")
                stall.AccentColor = null; // Clear color
            else if (!Regex.IsMatch(request.AccentColor, @"^#[0-9a-fA-F]{6}$"))
                return BadRequest(new { error = "INVALID_COLOR" });
            else
                stall.AccentColor = request.AccentColor;
        }

        stall.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(await GetStallResponse(stall.Id, userId.Value));
    }

    /// <summary>
    /// Delete a stall and all its items.
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteStall(Guid id)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var stall = await _db.Stalls
            .Include(s => s.Items)
            .FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId.Value);

        if (stall == null) return NotFound(new { error = "Stall not found." });

        // Prevent deleting the only stall
        var stallCount = await _db.Stalls.CountAsync(s => s.UserId == userId.Value);
        if (stallCount <= 1)
            return BadRequest(new { error = "LAST_STALL", message = "Cannot delete your only stall." });

        _db.Stalls.Remove(stall); // Cascade deletes items, images, tags, featured items
        await _db.SaveChangesAsync();

        return NoContent();
    }

    /// <summary>
    /// Upload header image for a stall.
    /// </summary>
    [HttpPost("{id:guid}/header")]
    [RequestSizeLimit(5 * 1024 * 1024)]
    public async Task<IActionResult> UploadHeader(Guid id, IFormFile file)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var stall = await _db.Stalls.FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId.Value);
        if (stall == null) return NotFound(new { error = "Stall not found." });

        var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
        if (!allowedTypes.Contains(file.ContentType.ToLower()))
            return BadRequest(new { error = "Only JPEG, PNG, GIF, and WebP images are allowed." });

        using var stream = file.OpenReadStream();
        var url = await _imageService.UploadStallImageAsync(stream, file.FileName, id, "header");

        stall.HeaderImageUrl = url;
        stall.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { headerImageUrl = url });
    }

    /// <summary>
    /// Remove header image.
    /// </summary>
    [HttpDelete("{id:guid}/header")]
    public async Task<IActionResult> DeleteHeader(Guid id)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var stall = await _db.Stalls.FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId.Value);
        if (stall == null) return NotFound(new { error = "Stall not found." });

        if (stall.HeaderImageUrl != null)
        {
            await _imageService.DeleteImageAsync($"manvaig/stalls/{id}/header");
            stall.HeaderImageUrl = null;
            stall.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        return NoContent();
    }

    /// <summary>
    /// Upload background image for a stall.
    /// </summary>
    [HttpPost("{id:guid}/background")]
    [RequestSizeLimit(5 * 1024 * 1024)]
    public async Task<IActionResult> UploadBackground(Guid id, IFormFile file)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var stall = await _db.Stalls.FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId.Value);
        if (stall == null) return NotFound(new { error = "Stall not found." });

        var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
        if (!allowedTypes.Contains(file.ContentType.ToLower()))
            return BadRequest(new { error = "Only JPEG, PNG, GIF, and WebP images are allowed." });

        using var stream = file.OpenReadStream();
        var url = await _imageService.UploadStallImageAsync(stream, file.FileName, id, "background");

        stall.BackgroundImageUrl = url;
        stall.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { backgroundImageUrl = url });
    }

    /// <summary>
    /// Remove background image.
    /// </summary>
    [HttpDelete("{id:guid}/background")]
    public async Task<IActionResult> DeleteBackground(Guid id)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var stall = await _db.Stalls.FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId.Value);
        if (stall == null) return NotFound(new { error = "Stall not found." });

        if (stall.BackgroundImageUrl != null)
        {
            await _imageService.DeleteImageAsync($"manvaig/stalls/{id}/background");
            stall.BackgroundImageUrl = null;
            stall.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        return NoContent();
    }

    /// <summary>
    /// Upload thumbnail image for a stall.
    /// </summary>
    [HttpPost("{id:guid}/thumbnail")]
    [RequestSizeLimit(2 * 1024 * 1024)]
    public async Task<IActionResult> UploadThumbnail(Guid id, IFormFile file)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var stall = await _db.Stalls.FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId.Value);
        if (stall == null) return NotFound(new { error = "Stall not found." });

        var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
        if (!allowedTypes.Contains(file.ContentType.ToLower()))
            return BadRequest(new { error = "Only JPEG, PNG, GIF, and WebP images are allowed." });

        using var stream = file.OpenReadStream();
        var url = await _imageService.UploadStallImageAsync(stream, file.FileName, id, "thumbnail");

        stall.ThumbnailUrl = url;
        stall.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { thumbnailUrl = url });
    }

    /// <summary>
    /// Remove thumbnail image.
    /// </summary>
    [HttpDelete("{id:guid}/thumbnail")]
    public async Task<IActionResult> DeleteThumbnail(Guid id)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var stall = await _db.Stalls.FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId.Value);
        if (stall == null) return NotFound(new { error = "Stall not found." });

        if (stall.ThumbnailUrl != null)
        {
            await _imageService.DeleteImageAsync($"manvaig/stalls/{id}/thumbnail");
            stall.ThumbnailUrl = null;
            stall.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        return NoContent();
    }

    /// <summary>
    /// Reorder stalls.
    /// </summary>
    [HttpPut("reorder")]
    public async Task<IActionResult> ReorderStalls([FromBody] ReorderStallsRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var stalls = await _db.Stalls
            .Where(s => s.UserId == userId.Value)
            .ToListAsync();

        for (int i = 0; i < request.StallIds.Count; i++)
        {
            var stall = stalls.FirstOrDefault(s => s.Id == request.StallIds[i]);
            if (stall != null)
                stall.SortOrder = i;
        }

        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Toggle featured status for an item in a stall.
    /// </summary>
    [HttpPost("{id:guid}/featured/{itemId:guid}")]
    public async Task<IActionResult> ToggleFeatured(Guid id, Guid itemId)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var stall = await _db.Stalls.FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId.Value);
        if (stall == null) return NotFound(new { error = "Stall not found." });

        // Verify item belongs to this stall
        var item = await _db.Items.FirstOrDefaultAsync(i => i.Id == itemId && i.StallId == id);
        if (item == null) return NotFound(new { error = "Item not found in this stall." });

        var existing = await _db.StallFeaturedItems
            .FirstOrDefaultAsync(f => f.StallId == id && f.ItemId == itemId);

        if (existing != null)
        {
            // Unfeature
            _db.StallFeaturedItems.Remove(existing);
        }
        else
        {
            // Check max 3
            var count = await _db.StallFeaturedItems.CountAsync(f => f.StallId == id);
            if (count >= 3)
                return BadRequest(new { error = "MAX_FEATURED", message = "Maximum 3 featured items per stall." });

            _db.StallFeaturedItems.Add(new StallFeaturedItem
            {
                StallId = id,
                ItemId = itemId,
                SortOrder = count
            });
        }

        await _db.SaveChangesAsync();
        return Ok(new { featured = existing == null });
    }

    // === Private helpers ===

    private Guid? GetCurrentUserId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return Guid.TryParse(raw, out var id) ? id : null;
    }

    private static string GenerateSlug(string name)
    {
        var slug = name.Trim().ToLowerInvariant();
        slug = Regex.Replace(slug, @"[^a-z0-9\s-]", ""); // Remove non-alphanumeric
        slug = Regex.Replace(slug, @"\s+", "-");           // Spaces to hyphens
        slug = Regex.Replace(slug, @"-+", "-");            // Collapse multiple hyphens
        slug = slug.Trim('-');
        return slug.Length > 50 ? slug[..50] : slug;
    }

    private async Task<string> EnsureUniqueSlug(Guid userId, string baseSlug)
    {
        var slug = baseSlug;
        var suffix = 1;
        while (await _db.Stalls.AnyAsync(s => s.UserId == userId && s.Slug == slug))
        {
            slug = $"{baseSlug}-{suffix}";
            suffix++;
        }
        return slug;
    }

    private async Task<StallResponse> GetStallResponse(Guid stallId, Guid userId)
    {
        return await _db.Stalls
            .Where(s => s.Id == stallId && s.UserId == userId)
            .Select(s => new StallResponse
            {
                Id = s.Id,
                Name = s.Name,
                Slug = s.Slug,
                Description = s.Description,
                ThumbnailUrl = s.ThumbnailUrl,
                HeaderImageUrl = s.HeaderImageUrl,
                BackgroundImageUrl = s.BackgroundImageUrl,
                AccentColor = s.AccentColor,
                SortOrder = s.SortOrder,
                IsDefault = s.IsDefault,
                ItemCount = s.Items.Count,
                PreviewImageUrls = s.Items
                    .SelectMany(i => i.Images.Where(img => img.IsPrimary).Select(img => img.Url))
                    .Take(4)
                    .ToList(),
                FeaturedItemIds = s.FeaturedItems
                    .OrderBy(f => f.SortOrder)
                    .Select(f => f.ItemId)
                    .ToList(),
                CreatedAt = s.CreatedAt,
                UpdatedAt = s.UpdatedAt
            })
            .FirstAsync();
    }
}
