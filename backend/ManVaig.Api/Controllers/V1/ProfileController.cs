using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using ManVaig.Api.Data;
using ManVaig.Api.Models;
using ManVaig.Api.Models.Dto;
using ManVaig.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ManVaig.Api.Controllers.V1;

[ApiController]
[Route("api/v1")]
public class ProfileController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly AppDbContext _db;
    private readonly IImageService _imageService;

    public ProfileController(
        UserManager<ApplicationUser> userManager,
        AppDbContext db,
        IImageService imageService)
    {
        _userManager = userManager;
        _db = db;
        _imageService = imageService;
    }

    [HttpGet("profile")]
    [Authorize]
    public async Task<IActionResult> GetMyProfile()
    {
        var user = await GetCurrentUserWithBadges();
        if (user == null) return Unauthorized();

        return Ok(MapToResponse(user, isOwner: true));
    }

    [HttpPut("profile")]
    [Authorize]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var user = await GetCurrentUserWithBadges();
        if (user == null) return Unauthorized();

        if (request.Bio != null) user.Bio = request.Bio;
        if (request.Location != null) user.Location = request.Location;
        if (request.Phone != null) user.Phone = request.Phone;
        if (request.IsProfilePublic.HasValue) user.IsProfilePublic = request.IsProfilePublic.Value;
        if (request.EnabledChannels.HasValue) user.EnabledChannels = request.EnabledChannels.Value;

        if (request.DisplayedBadgeIds != null)
        {
            if (request.DisplayedBadgeIds.Count > 3)
                return BadRequest(new { error = "You can display up to 3 badges." });

            // Validate that user owns these badges
            var ownedBadgeIds = await _db.UserBadges
                .Where(ub => ub.UserId == user.Id)
                .Select(ub => ub.BadgeDefinitionId)
                .ToListAsync();

            if (request.DisplayedBadgeIds.Any(id => !ownedBadgeIds.Contains(id)))
                return BadRequest(new { error = "You can only display badges you have earned." });

            // Replace displayed badges
            var existing = await _db.UserDisplayedBadges
                .Where(db => db.UserId == user.Id)
                .ToListAsync();
            _db.UserDisplayedBadges.RemoveRange(existing);

            for (int i = 0; i < request.DisplayedBadgeIds.Count; i++)
            {
                _db.UserDisplayedBadges.Add(new UserDisplayedBadge
                {
                    UserId = user.Id,
                    BadgeDefinitionId = request.DisplayedBadgeIds[i],
                    SortOrder = i
                });
            }
        }

        await _db.SaveChangesAsync();

        // Reload badges for response
        user = await GetCurrentUserWithBadges();
        return Ok(MapToResponse(user!, isOwner: true));
    }

    [HttpPost("profile/avatar")]
    [Authorize]
    [RequestSizeLimit(2 * 1024 * 1024)] // 2MB
    public async Task<IActionResult> UploadAvatar(IFormFile file)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return Unauthorized();

        var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
        if (!allowedTypes.Contains(file.ContentType.ToLower()))
            return BadRequest(new { error = "Only JPEG, PNG, GIF, and WebP images are allowed." });

        using var stream = file.OpenReadStream();
        var avatarUrl = await _imageService.UploadAvatarAsync(stream, file.FileName, user.Id);

        user.AvatarUrl = avatarUrl;
        await _userManager.UpdateAsync(user);

        return Ok(new { avatarUrl });
    }

    [HttpGet("users/{displayName}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublicProfile(string displayName)
    {
        var user = await _db.Users
            .Include(u => u.DisplayedBadges)
                .ThenInclude(db => db.BadgeDefinition)
            .FirstOrDefaultAsync(u => u.DisplayName != null
                && u.DisplayName.ToLower() == displayName.ToLower()
                && u.IsActive
                && u.IsProfilePublic);

        if (user == null)
            return NotFound(new { error = "Profile not found." });

        return Ok(MapToResponse(user, isOwner: false));
    }

    private string? GetCurrentUserId()
    {
        return User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
    }

    private async Task<ApplicationUser?> GetCurrentUserWithBadges()
    {
        var userId = GetCurrentUserId();
        if (userId == null) return null;

        return await _db.Users
            .Include(u => u.DisplayedBadges)
                .ThenInclude(db => db.BadgeDefinition)
            .FirstOrDefaultAsync(u => u.Id.ToString() == userId);
    }

    private static UserProfileResponse MapToResponse(ApplicationUser user, bool isOwner)
    {
        return new UserProfileResponse
        {
            UserId = user.Id,
            DisplayName = user.DisplayName ?? "",
            Email = isOwner ? user.Email : null,
            EmailConfirmed = isOwner ? user.EmailConfirmed : null,
            Phone = isOwner ? user.Phone : null,
            PhoneVerified = isOwner ? false : null, // Always false in v1
            AvatarUrl = user.AvatarUrl,
            Bio = user.Bio,
            Location = user.Location,
            IsProfilePublic = user.IsProfilePublic,
            EnabledChannels = user.EnabledChannels,
            MemberSince = user.CreatedAt,
            DisplayedBadges = user.DisplayedBadges
                .OrderBy(db => db.SortOrder)
                .Select(db => new BadgeDto
                {
                    Id = db.BadgeDefinition.Id,
                    Key = db.BadgeDefinition.Key,
                    Name = db.BadgeDefinition.Name,
                    IconUrl = db.BadgeDefinition.IconUrl
                }).ToList()
        };
    }
}
