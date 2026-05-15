using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using ManVaig.Api.Data;
using ManVaig.Api.Models;
using ManVaig.Api.Models.Dto;
using ManVaig.Api.Models.Enums;
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

        return Ok(await MapToResponse(user, isOwner: true));
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
        if (request.TelegramUsername != null)
        {
            // Strip leading @ if present
            var tgName = request.TelegramUsername.Trim().TrimStart('@');
            user.TelegramUsername = string.IsNullOrEmpty(tgName) ? null : tgName;
        }

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
        return Ok(await MapToResponse(user!, isOwner: true));
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
                && u.IsActive);

        if (user == null)
            return NotFound(new { error = "Profile not found." });

        // Private profile + anonymous viewer → limited response (avatar + name only)
        if (!user.IsProfilePublic && User.Identity?.IsAuthenticated != true)
        {
            return Ok(new UserProfileResponse
            {
                UserId = user.Id,
                DisplayName = user.DisplayName ?? "",
                AvatarUrl = user.AvatarUrl,
                IsProfilePublic = false,
                MemberSince = user.CreatedAt,
            });
        }

        Guid? viewerId = Guid.TryParse(GetCurrentUserId(), out var vid) ? vid : null;
        return Ok(await MapToResponse(user, isOwner: false, viewerId));
    }

    /// <summary>
    /// Get public listings for a user (no auth required).
    /// </summary>
    [HttpGet("users/{displayName}/listings")]
    [AllowAnonymous]
    public async Task<IActionResult> GetUserListings(string displayName, [FromQuery] int limit = 6)
    {
        limit = Math.Clamp(limit, 1, 20);

        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.DisplayName != null
                && u.DisplayName.ToLower() == displayName.ToLower()
                && u.IsActive);

        if (user == null)
            return NotFound(new { error = "Profile not found." });

        // Private profile + anonymous viewer → no listings
        if (!user.IsProfilePublic && User.Identity?.IsAuthenticated != true)
            return Ok(Array.Empty<PublicItemCardDto>());

        var items = await _db.Items
            .Where(i => i.UserId == user.Id && i.Visibility == ItemVisibility.Public)
            .Where(i => i.Stall.Visibility == StallVisibility.Public)
            .Where(i => !i.IsSold)
            .OrderByDescending(i => i.CreatedAt)
            .Take(limit)
            .Select(i => new PublicItemCardDto
            {
                Id = i.Id,
                Title = i.Title,
                CategoryId = i.CategoryId,
                CategoryName = i.Category.Name,
                Condition = i.Condition,
                Price = i.Price,
                AcceptOffers = i.AcceptOffers,
                MinOfferPrice = i.MinOfferPrice,
                OfferStep = i.OfferStep,
                EndDate = i.EndDate,
                Location = i.Location,
                CanShip = i.CanShip,
                CreatedAt = i.CreatedAt,
                Images = i.Images
                    .OrderBy(img => img.SortOrder)
                    .Select(img => new ItemImageDto
                    {
                        Id = img.Id,
                        Url = img.Url,
                        SortOrder = img.SortOrder,
                        IsPrimary = img.IsPrimary
                    }).ToList(),
                Tags = i.ItemTags.Select(it => it.Tag.Name).ToList(),
                Seller = new PublicSellerSummaryDto
                {
                    DisplayName = user.DisplayName ?? "User",
                    AvatarUrl = user.AvatarUrl,
                    Location = user.Location,
                    MemberSince = user.CreatedAt
                },
                BidCount = i.Bids.Count(b => b.Status == BidStatus.Active),
                HighestBid = i.Bids.Any(b => b.Status == BidStatus.Active)
                    ? i.Bids.Where(b => b.Status == BidStatus.Active).Max(b => b.Amount)
                    : (decimal?)null
            })
            .ToListAsync();

        return Ok(items);
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

    private async Task<UserProfileResponse> MapToResponse(ApplicationUser user, bool isOwner, Guid? viewerId = null)
    {
        // Compute stats
        var stallCount = await _db.Stalls.CountAsync(s => s.UserId == user.Id);
        var activeListingCount = await _db.Items.CountAsync(i =>
            i.UserId == user.Id
            && i.Visibility == ItemVisibility.Public
            && i.Stall.Visibility == StallVisibility.Public
            && !i.IsSold);
        var completedDealCount = await _db.Items.CountAsync(i =>
            i.UserId == user.Id && i.IsSold);
        var followerCount = await _db.UserFollows.CountAsync(f => f.FolloweeId == user.Id);
        var followingCount = await _db.UserFollows.CountAsync(f => f.FollowerId == user.Id);

        bool? isFollowedByMe = null;
        if (viewerId.HasValue && !isOwner)
        {
            isFollowedByMe = await _db.UserFollows.AnyAsync(f => f.FollowerId == viewerId.Value && f.FolloweeId == user.Id);
        }

        var channels = user.EnabledChannels;

        // Build public contact links (only for public viewers, based on enabled channels)
        string? publicEmail = null;
        string? publicPhone = null;
        string? publicWhatsAppUrl = null;
        string? publicTelegramUrl = null;

        if (!isOwner)
        {
            if (channels.HasFlag(CommunicationChannels.ShowEmail) && user.EmailConfirmed)
                publicEmail = user.Email;

            if (channels.HasFlag(CommunicationChannels.ShowPhone) && !string.IsNullOrEmpty(user.Phone))
                publicPhone = user.Phone;

            // WhatsApp requires both ShowPhone AND WhatsApp flags (it's a sub-option of phone)
            if (channels.HasFlag(CommunicationChannels.ShowPhone)
                && channels.HasFlag(CommunicationChannels.WhatsApp)
                && !string.IsNullOrEmpty(user.Phone))
                publicWhatsAppUrl = $"https://wa.me/{user.Phone.Replace(" ", "").Replace("+", "")}";

            if (channels.HasFlag(CommunicationChannels.Telegram) && !string.IsNullOrEmpty(user.TelegramUsername))
                publicTelegramUrl = $"https://t.me/{user.TelegramUsername}";
        }

        return new UserProfileResponse
        {
            UserId = user.Id,
            DisplayName = user.DisplayName ?? "",
            Email = isOwner ? user.Email : null,
            EmailConfirmed = isOwner ? user.EmailConfirmed : null,
            Phone = isOwner ? user.Phone : null,
            PhoneVerified = isOwner ? user.PhoneNumberConfirmed : null,
            AvatarUrl = user.AvatarUrl,
            Bio = user.Bio,
            Location = user.Location,
            IsProfilePublic = user.IsProfilePublic,
            EnabledChannels = user.EnabledChannels,
            TelegramUsername = isOwner ? user.TelegramUsername : null,
            MemberSince = user.CreatedAt,
            LastSeenAt = user.LastSeenAt,
            PublicEmail = publicEmail,
            PublicPhone = publicPhone,
            PublicWhatsAppUrl = publicWhatsAppUrl,
            PublicTelegramUrl = publicTelegramUrl,
            StallCount = stallCount,
            ActiveListingCount = activeListingCount,
            CompletedDealCount = completedDealCount,
            FollowerCount = followerCount,
            FollowingCount = followingCount,
            IsFollowedByMe = isFollowedByMe,
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
