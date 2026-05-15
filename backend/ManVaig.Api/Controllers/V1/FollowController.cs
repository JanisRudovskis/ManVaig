using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using ManVaig.Api.Data;
using ManVaig.Api.Models;
using ManVaig.Api.Models.Dto;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ManVaig.Api.Controllers.V1;

[ApiController]
[Route("api/v1/users/{displayName}")]
public class FollowController : ControllerBase
{
    private readonly AppDbContext _db;

    public FollowController(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>Follow a user.</summary>
    [HttpPost("follow")]
    [Authorize]
    public async Task<IActionResult> Follow(string displayName)
    {
        var currentUserId = GetCurrentUserId();
        if (currentUserId == null) return Unauthorized();

        var target = await _db.Users
            .FirstOrDefaultAsync(u => u.DisplayName != null
                && u.DisplayName.ToLower() == displayName.ToLower()
                && u.IsActive);

        if (target == null)
            return NotFound(new { error = "User not found." });

        if (target.Id == currentUserId.Value)
            return BadRequest(new { error = "CANNOT_FOLLOW_SELF" });

        // Idempotent — don't error if already following
        var exists = await _db.UserFollows.AnyAsync(f =>
            f.FollowerId == currentUserId.Value && f.FolloweeId == target.Id);

        if (!exists)
        {
            try
            {
                _db.UserFollows.Add(new UserFollow
                {
                    FollowerId = currentUserId.Value,
                    FolloweeId = target.Id,
                });
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                // Race condition: another request already inserted — idempotent, ignore
            }
        }

        return Ok(new { followed = true });
    }

    /// <summary>Unfollow a user.</summary>
    [HttpDelete("follow")]
    [Authorize]
    public async Task<IActionResult> Unfollow(string displayName)
    {
        var currentUserId = GetCurrentUserId();
        if (currentUserId == null) return Unauthorized();

        var target = await _db.Users
            .FirstOrDefaultAsync(u => u.DisplayName != null
                && u.DisplayName.ToLower() == displayName.ToLower()
                && u.IsActive);

        if (target == null)
            return NotFound(new { error = "User not found." });

        var follow = await _db.UserFollows
            .FirstOrDefaultAsync(f => f.FollowerId == currentUserId.Value && f.FolloweeId == target.Id);

        if (follow != null)
        {
            _db.UserFollows.Remove(follow);
            await _db.SaveChangesAsync();
        }

        return Ok(new { followed = false });
    }

    /// <summary>Get followers of a user (paginated).</summary>
    [HttpGet("followers")]
    [AllowAnonymous]
    public async Task<IActionResult> GetFollowers(string displayName, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var target = await _db.Users
            .FirstOrDefaultAsync(u => u.DisplayName != null
                && u.DisplayName.ToLower() == displayName.ToLower()
                && u.IsActive);

        if (target == null)
            return NotFound(new { error = "User not found." });

        // Private profile + anonymous → empty list
        if (!target.IsProfilePublic && User.Identity?.IsAuthenticated != true)
            return Ok(new FollowListResponse { Page = page, PageSize = pageSize });

        var query = _db.UserFollows
            .Where(f => f.FolloweeId == target.Id)
            .OrderByDescending(f => f.CreatedAt);

        var totalCount = await query.CountAsync();

        var users = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(f => new FollowUserDto
            {
                UserId = f.Follower.Id,
                DisplayName = f.Follower.DisplayName ?? "",
                AvatarUrl = f.Follower.AvatarUrl,
                Location = f.Follower.Location,
                FollowedSince = f.CreatedAt,
            })
            .ToListAsync();

        return Ok(new FollowListResponse
        {
            Users = users,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
        });
    }

    /// <summary>Get users that a user follows (paginated).</summary>
    [HttpGet("following")]
    [AllowAnonymous]
    public async Task<IActionResult> GetFollowing(string displayName, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var target = await _db.Users
            .FirstOrDefaultAsync(u => u.DisplayName != null
                && u.DisplayName.ToLower() == displayName.ToLower()
                && u.IsActive);

        if (target == null)
            return NotFound(new { error = "User not found." });

        // Private profile + anonymous → empty list
        if (!target.IsProfilePublic && User.Identity?.IsAuthenticated != true)
            return Ok(new FollowListResponse { Page = page, PageSize = pageSize });

        var query = _db.UserFollows
            .Where(f => f.FollowerId == target.Id)
            .OrderByDescending(f => f.CreatedAt);

        var totalCount = await query.CountAsync();

        var users = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(f => new FollowUserDto
            {
                UserId = f.Followee.Id,
                DisplayName = f.Followee.DisplayName ?? "",
                AvatarUrl = f.Followee.AvatarUrl,
                Location = f.Followee.Location,
                FollowedSince = f.CreatedAt,
            })
            .ToListAsync();

        return Ok(new FollowListResponse
        {
            Users = users,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
        });
    }

    private Guid? GetCurrentUserId()
    {
        var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return Guid.TryParse(idStr, out var id) ? id : null;
    }
}
