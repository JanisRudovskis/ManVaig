using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using ManVaig.Api.Data;
using ManVaig.Api.Models;
using ManVaig.Api.Models.Dto;
using ManVaig.Api.Models.Enums;
using ManVaig.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ManVaig.Api.Controllers.V1;

[ApiController]
[Route("api/v1/items")]
[Authorize]
public class ItemsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IImageService _imageService;
    private readonly INotificationService _notificationService;

    public ItemsController(AppDbContext db, IImageService imageService, INotificationService notificationService)
    {
        _db = db;
        _imageService = imageService;
        _notificationService = notificationService;
    }

    /// <summary>
    /// List current user's items (paginated, sortable).
    /// Sort options: newest (default), oldest, priceAsc, priceDesc, custom.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetMyItems(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] Guid? stallId = null,
        [FromQuery] string sort = "newest")
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var query = _db.Items
            .Where(i => i.UserId == userId.Value);

        if (stallId.HasValue)
            query = query.Where(i => i.StallId == stallId.Value);

        // Apply sort
        query = sort switch
        {
            "oldest" => query.OrderBy(i => i.CreatedAt),
            "priceAsc" => query.OrderBy(i => i.Price ?? i.MinOfferPrice ?? decimal.MaxValue),
            "priceDesc" => query.OrderByDescending(i => i.Price ?? i.MinOfferPrice ?? 0),
            "custom" => query.OrderBy(i => i.SortOrder).ThenByDescending(i => i.CreatedAt),
            _ => query.OrderByDescending(i => i.CreatedAt), // "newest" and fallback
        };

        var totalCount = await query.CountAsync();

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Include(i => i.Stall)
            .Include(i => i.Category)
            .Include(i => i.Images.OrderBy(img => img.SortOrder))
            .Include(i => i.ItemTags)
                .ThenInclude(it => it.Tag)
            .Include(i => i.Bids)
            .ToListAsync();

        return Ok(new ItemListResponse
        {
            Items = items.Select(MapToResponse).ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        });
    }

    /// <summary>
    /// Get a single item by ID (owner only, for edit form).
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetItem(Guid id)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var item = await GetItemWithIncludes()
            .FirstOrDefaultAsync(i => i.Id == id && i.UserId == userId.Value);

        if (item == null) return NotFound(new { error = "Item not found." });

        return Ok(MapToResponse(item));
    }

    /// <summary>
    /// Create a new item.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateItem([FromBody] CreateItemRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        // Check item limit
        var user = await _db.Users.FindAsync(userId.Value);
        if (user == null) return Unauthorized();

        var currentCount = await _db.Items.CountAsync(i => i.UserId == userId.Value);
        if (currentCount >= user.MaxItems)
            return BadRequest(new { error = "ITEM_LIMIT_REACHED", maxItems = user.MaxItems });

        // Validate title length
        if (request.Title.Trim().Length < 3 || request.Title.Trim().Length > 100)
            return BadRequest(new { error = "TITLE_LENGTH" });

        // Validate description length
        if (request.Description != null && request.Description.Length > 2000)
            return BadRequest(new { error = "DESCRIPTION_LENGTH" });

        // Validate tags
        if (request.Tags is { Count: > 10 })
            return BadRequest(new { error = "TAGS_LIMIT" });
        if (request.Tags != null && request.Tags.Any(t => t.Trim().Length > 30))
            return BadRequest(new { error = "TAG_LENGTH" });

        // Validate category exists
        var categoryExists = await _db.Categories.AnyAsync(c => c.Id == request.CategoryId);
        if (!categoryExists)
            return BadRequest(new { error = "INVALID_CATEGORY" });

        // Validate pricing fields (composable)
        var pricingError = ValidatePricingFields(
            request.Price, request.AcceptOffers,
            request.MinOfferPrice, request.OfferStep, request.EndDate);
        if (pricingError != null)
            return BadRequest(new { error = pricingError });

        // Silently clear irrelevant fields when offers disabled
        var minOfferPrice = request.AcceptOffers ? request.MinOfferPrice : null;
        var offerStep = request.AcceptOffers ? request.OfferStep : null;
        var endDate = request.AcceptOffers && request.EndDate.HasValue
            ? DateTime.SpecifyKind(request.EndDate.Value, DateTimeKind.Utc)
            : (DateTime?)null;

        // Resolve stall
        Guid stallId;
        if (request.StallId.HasValue)
        {
            // Validate stall belongs to user
            var stallExists = await _db.Stalls.AnyAsync(s => s.Id == request.StallId.Value && s.UserId == userId.Value);
            if (!stallExists)
                return BadRequest(new { error = "INVALID_STALL" });
            stallId = request.StallId.Value;
        }
        else
        {
            // Auto-create default stall if user has none
            var defaultStall = await _db.Stalls.FirstOrDefaultAsync(s => s.UserId == userId.Value && s.IsDefault);
            if (defaultStall == null)
            {
                defaultStall = new Stall
                {
                    Id = Guid.NewGuid(),
                    UserId = userId.Value,
                    Name = "General",
                    Slug = "general",
                    IsDefault = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _db.Stalls.Add(defaultStall);
                await _db.SaveChangesAsync();
            }
            stallId = defaultStall.Id;
        }

        var item = new Item
        {
            Id = Guid.NewGuid(),
            UserId = userId.Value,
            StallId = stallId,
            CategoryId = request.CategoryId,
            Title = request.Title,
            Description = request.Description,
            Condition = request.Condition,
            Price = request.Price,
            AcceptOffers = request.AcceptOffers,
            MinOfferPrice = minOfferPrice,
            OfferStep = offerStep,
            EndDate = endDate,
            Visibility = request.Visibility,
            Location = request.Location,
            CanShip = request.CanShip,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.Items.Add(item);

        // Handle tags
        if (request.Tags is { Count: > 0 })
        {
            await SyncTags(item, request.Tags);
        }

        await _db.SaveChangesAsync();

        // Notify followers about new item (only for public items)
        if (item.Visibility == ItemVisibility.Public)
        {
            await _notificationService.NotifyNewItemFromFollowed(userId.Value, item.Id);
        }

        // Reload with includes for response
        var created = await GetItemWithIncludes()
            .FirstAsync(i => i.Id == item.Id);

        return CreatedAtAction(nameof(GetItem), new { id = item.Id }, MapToResponse(created));
    }

    /// <summary>
    /// Update an existing item (partial update — null fields are skipped).
    /// </summary>
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateItem(Guid id, [FromBody] UpdateItemRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var item = await _db.Items
            .Include(i => i.ItemTags)
            .FirstOrDefaultAsync(i => i.Id == id && i.UserId == userId.Value);

        if (item == null) return NotFound(new { error = "Item not found." });

        // Check offer lock (timed items with active offers)
        var lockError = await CheckOfferLock(item);
        if (lockError != null)
            return StatusCode(403, new { error = lockError });

        // Apply partial updates
        // Move to different stall
        if (request.StallId.HasValue && request.StallId.Value != item.StallId)
        {
            var stallExists = await _db.Stalls.AnyAsync(s => s.Id == request.StallId.Value && s.UserId == userId.Value);
            if (!stallExists)
                return BadRequest(new { error = "INVALID_STALL" });
            item.StallId = request.StallId.Value;

            // Remove from featured items if it was featured in old stall
            var featured = await _db.StallFeaturedItems
                .Where(f => f.ItemId == id)
                .ToListAsync();
            _db.StallFeaturedItems.RemoveRange(featured);
        }

        if (request.Title != null) item.Title = request.Title;
        if (request.Description != null) item.Description = request.Description;
        if (request.Condition.HasValue) item.Condition = request.Condition.Value;
        if (request.Visibility.HasValue) item.Visibility = request.Visibility.Value;
        if (request.Location != null) item.Location = request.Location;
        if (request.CanShip.HasValue) item.CanShip = request.CanShip.Value;

        if (request.CategoryId.HasValue)
        {
            var categoryExists = await _db.Categories.AnyAsync(c => c.Id == request.CategoryId.Value);
            if (!categoryExists)
                return BadRequest(new { error = "INVALID_CATEGORY" });
            item.CategoryId = request.CategoryId.Value;
        }

        // Update pricing fields
        if (request.AcceptOffers.HasValue)
            item.AcceptOffers = request.AcceptOffers.Value;

        if (request.Price.HasValue) item.Price = request.Price.Value;
        if (request.MinOfferPrice.HasValue) item.MinOfferPrice = request.MinOfferPrice.Value;
        if (request.OfferStep.HasValue) item.OfferStep = request.OfferStep.Value;
        if (request.EndDate.HasValue) item.EndDate = DateTime.SpecifyKind(request.EndDate.Value, DateTimeKind.Utc);

        // Allow clearing pricing fields when toggling offers off
        if (request.ClearPricingFields)
        {
            item.Price = request.Price;
            item.MinOfferPrice = request.MinOfferPrice;
            item.OfferStep = request.OfferStep;
            item.EndDate = request.EndDate.HasValue
                ? DateTime.SpecifyKind(request.EndDate.Value, DateTimeKind.Utc)
                : null;
        }

        // Silently clear irrelevant fields when offers disabled
        if (!item.AcceptOffers)
        {
            item.MinOfferPrice = null;
            item.OfferStep = null;
            item.EndDate = null;
        }

        // Validate final pricing state
        var pricingError = ValidatePricingFields(
            item.Price, item.AcceptOffers,
            item.MinOfferPrice, item.OfferStep, item.EndDate);
        if (pricingError != null)
            return BadRequest(new { error = pricingError });

        // Sync tags if provided
        if (request.Tags != null)
        {
            await SyncTags(item, request.Tags);
        }

        item.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // Reload with includes
        var updated = await GetItemWithIncludes()
            .FirstAsync(i => i.Id == item.Id);

        return Ok(MapToResponse(updated));
    }

    /// <summary>
    /// Delete an item (owner only).
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteItem(Guid id)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var item = await _db.Items
            .FirstOrDefaultAsync(i => i.Id == id && i.UserId == userId.Value);

        if (item == null) return NotFound(new { error = "Item not found." });

        // Check offer lock
        var lockError = await CheckOfferLock(item);
        if (lockError != null)
            return StatusCode(403, new { error = lockError });

        // Notify subscribers before deleting (item title will be lost after cascade)
        await _notificationService.NotifyItemDeleted(item.Id, item.UserId, item.Title);

        _db.Items.Remove(item); // Cascade deletes images, item-tags, subscriptions
        await _db.SaveChangesAsync();

        return NoContent();
    }

    // === Image endpoints ===

    private static readonly HashSet<string> AllowedImageTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/webp", "image/gif"
    };

    private const long MaxImageSize = 5 * 1024 * 1024; // 5MB
    private const int MaxImagesPerItem = 5;

    /// <summary>
    /// Upload images to an item (multipart, max 5 total).
    /// </summary>
    [HttpPost("{id:guid}/images")]
    public async Task<IActionResult> UploadImages(Guid id, [FromForm] List<IFormFile> files)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var item = await _db.Items
            .Include(i => i.Images)
            .FirstOrDefaultAsync(i => i.Id == id && i.UserId == userId.Value);

        if (item == null) return NotFound(new { error = "Item not found." });

        // Check offer lock
        var lockError = await CheckOfferLock(item);
        if (lockError != null)
            return StatusCode(403, new { error = lockError });

        if (files == null || files.Count == 0)
            return BadRequest(new { error = "NO_FILES" });

        var currentCount = item.Images?.Count ?? 0;
        if (currentCount + files.Count > MaxImagesPerItem)
            return BadRequest(new { error = "IMAGE_LIMIT_REACHED", max = MaxImagesPerItem });

        // Validate all files first
        foreach (var file in files)
        {
            if (file.Length > MaxImageSize)
                return BadRequest(new { error = "IMAGE_TOO_LARGE" });
            if (!AllowedImageTypes.Contains(file.ContentType))
                return BadRequest(new { error = "IMAGE_INVALID_TYPE" });
        }

        var uploadedImages = new List<ItemImageDto>();
        var nextSortOrder = currentCount;

        foreach (var file in files)
        {
            var imageId = Guid.NewGuid();

            await using var stream = file.OpenReadStream();
            var url = await _imageService.UploadItemImageAsync(stream, file.FileName, id, imageId);

            var image = new ItemImage
            {
                Id = imageId,
                ItemId = id,
                Url = url,
                SortOrder = nextSortOrder,
                IsPrimary = currentCount == 0 && nextSortOrder == 0 // First image is primary
            };

            _db.Set<ItemImage>().Add(image);
            nextSortOrder++;

            uploadedImages.Add(new ItemImageDto
            {
                Id = image.Id,
                Url = image.Url,
                SortOrder = image.SortOrder,
                IsPrimary = image.IsPrimary
            });
        }

        item.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(uploadedImages);
    }

    /// <summary>
    /// Reorder images and set primary.
    /// </summary>
    [HttpPut("{id:guid}/images/reorder")]
    public async Task<IActionResult> ReorderImages(Guid id, [FromBody] ReorderImagesRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var item = await _db.Items
            .Include(i => i.Images)
            .FirstOrDefaultAsync(i => i.Id == id && i.UserId == userId.Value);

        if (item == null) return NotFound(new { error = "Item not found." });

        var lockError = await CheckOfferLock(item);
        if (lockError != null)
            return StatusCode(403, new { error = lockError });

        if (request.ImageIds == null || request.ImageIds.Count == 0)
            return BadRequest(new { error = "NO_IMAGE_IDS" });

        var images = item.Images?.ToList() ?? new();
        var imageMap = images.ToDictionary(i => i.Id);

        // Validate all IDs belong to this item
        foreach (var imgId in request.ImageIds)
        {
            if (!imageMap.ContainsKey(imgId))
                return BadRequest(new { error = "IMAGE_NOT_FOUND" });
        }

        // Update sort order and primary flag
        for (int i = 0; i < request.ImageIds.Count; i++)
        {
            var img = imageMap[request.ImageIds[i]];
            img.SortOrder = i;
            img.IsPrimary = i == 0; // First in order is primary
        }

        item.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(images.OrderBy(i => i.SortOrder).Select(i => new ItemImageDto
        {
            Id = i.Id,
            Url = i.Url,
            SortOrder = i.SortOrder,
            IsPrimary = i.IsPrimary
        }));
    }

    /// <summary>
    /// Reorder items within a stall (custom sort order).
    /// </summary>
    [HttpPut("reorder")]
    public async Task<IActionResult> ReorderItems([FromBody] ReorderItemsRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        // Validate stall ownership
        var stallOwned = await _db.Stalls.AnyAsync(s => s.Id == request.StallId && s.UserId == userId.Value);
        if (!stallOwned)
            return BadRequest(new { error = "INVALID_STALL" });

        var items = await _db.Items
            .Where(i => i.StallId == request.StallId && i.UserId == userId.Value)
            .ToListAsync();

        for (int i = 0; i < request.ItemIds.Count; i++)
        {
            var item = items.FirstOrDefault(it => it.Id == request.ItemIds[i]);
            if (item != null)
                item.SortOrder = i;
        }

        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Delete a single image from an item.
    /// </summary>
    [HttpDelete("{id:guid}/images/{imageId:guid}")]
    public async Task<IActionResult> DeleteImage(Guid id, Guid imageId)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var item = await _db.Items
            .Include(i => i.Images)
            .FirstOrDefaultAsync(i => i.Id == id && i.UserId == userId.Value);

        if (item == null) return NotFound(new { error = "Item not found." });

        var lockError = await CheckOfferLock(item);
        if (lockError != null)
            return StatusCode(403, new { error = lockError });

        var image = item.Images?.FirstOrDefault(i => i.Id == imageId);
        if (image == null) return NotFound(new { error = "Image not found." });

        // Delete from Cloudinary
        var publicId = $"manvaig/items/{id}/{imageId}";
        await _imageService.DeleteImageAsync(publicId);

        _db.Set<ItemImage>().Remove(image);

        // If deleted image was primary, set next one as primary
        var remaining = item.Images!.Where(i => i.Id != imageId).OrderBy(i => i.SortOrder).ToList();
        if (image.IsPrimary && remaining.Count > 0)
        {
            remaining[0].IsPrimary = true;
        }

        // Re-index sort order
        for (int i = 0; i < remaining.Count; i++)
        {
            remaining[i].SortOrder = i;
        }

        item.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return NoContent();
    }

    // === Private helpers ===

    private Guid? GetCurrentUserId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);

        return Guid.TryParse(raw, out var id) ? id : null;
    }

    private IQueryable<Item> GetItemWithIncludes()
    {
        return _db.Items
            .Include(i => i.Stall)
            .Include(i => i.Category)
            .Include(i => i.Images.OrderBy(img => img.SortOrder))
            .Include(i => i.ItemTags)
                .ThenInclude(it => it.Tag)
            .Include(i => i.Bids);
    }

    private async Task SyncTags(Item item, List<string> tagNames)
    {
        // Normalize: trim, lowercase, deduplicate, max 10
        var normalized = tagNames
            .Select(t => t.Trim().ToLowerInvariant())
            .Where(t => t.Length > 0 && t.Length <= 50)
            .Distinct()
            .Take(10)
            .ToList();

        // Find existing tags
        var existingTags = await _db.Tags
            .Where(t => normalized.Contains(t.Name))
            .ToListAsync();

        var existingNames = existingTags.Select(t => t.Name).ToHashSet();

        // Create new tags
        var newTags = normalized
            .Where(n => !existingNames.Contains(n))
            .Select(n => new Tag { Name = n })
            .ToList();

        if (newTags.Count > 0)
        {
            _db.Tags.AddRange(newTags);
            await _db.SaveChangesAsync(); // Need IDs for join table
        }

        var allTags = existingTags.Concat(newTags).ToList();

        // Remove old item-tags
        var oldItemTags = await _db.ItemTags
            .Where(it => it.ItemId == item.Id)
            .ToListAsync();
        _db.ItemTags.RemoveRange(oldItemTags);

        // Add new item-tags
        foreach (var tag in allTags)
        {
            _db.ItemTags.Add(new ItemTag { ItemId = item.Id, TagId = tag.Id });
        }
    }

    /// <summary>
    /// Composable pricing validation.
    /// </summary>
    private static string? ValidatePricingFields(
        decimal? price, bool acceptOffers,
        decimal? minOfferPrice, decimal? offerStep, DateTime? endDate)
    {
        // Must have price or accept offers (otherwise nothing for buyers to do)
        if (!price.HasValue && !acceptOffers)
            return "NO_BUYER_ACTION";

        // Price must be positive when set
        if (price.HasValue && price.Value <= 0)
            return "PRICE_POSITIVE";

        // End date requires offers to be enabled
        if (endDate.HasValue && !acceptOffers)
            return "ENDDATE_REQUIRES_OFFERS";

        // End date must be at least 1 hour in the future
        if (endDate.HasValue && endDate.Value <= DateTime.UtcNow.AddHours(5))
            return "ENDDATE_TOO_SOON";

        // Min offer price can't exceed listed price
        if (minOfferPrice.HasValue && price.HasValue && minOfferPrice.Value > price.Value)
            return "MIN_OFFER_EXCEEDS_PRICE";

        // No negative values
        if (minOfferPrice.HasValue && minOfferPrice.Value < 0)
            return "MIN_OFFER_NEGATIVE";

        // Offer step is required when offers are enabled
        if (acceptOffers && !offerStep.HasValue)
            return "OFFER_STEP_REQUIRED";

        // Offer step must be positive when set
        if (offerStep.HasValue && offerStep.Value <= 0)
            return "OFFER_STEP_POSITIVE";

        return null;
    }

    /// <summary>
    /// Check if an item is locked due to active offer negotiations.
    /// Returns an error message if locked, null if editable.
    /// Locked when: accepted bid in progress, completed (sold), or timed with active bids.
    /// </summary>
    private async Task<string?> CheckOfferLock(Item item)
    {
        if (!item.AcceptOffers)
            return null;

        // Sold items are always locked
        if (item.IsSold)
            return "OFFERS_LOCKED";

        // Timed items with active bids: locked during auction and 48h grace period
        if (item.EndDate.HasValue)
        {
            var hasOffers = await _db.Bids.AnyAsync(b => b.ItemId == item.Id && b.Status == BidStatus.Active);

            if (hasOffers)
            {
                if (item.EndDate.Value > DateTime.UtcNow)
                    return "OFFERS_LOCKED";

                var gracePeriodEnd = item.EndDate.Value.AddHours(48);
                if (DateTime.UtcNow < gracePeriodEnd)
                    return "OFFERS_GRACE_PERIOD";
            }
        }

        return null;
    }

    private static ItemResponse MapToResponse(Item item)
    {
        var activeBids = item.Bids?.Where(b => b.Status == BidStatus.Active).ToList();
        var allBids = item.Bids?.ToList();

        return new ItemResponse
        {
            Id = item.Id,
            UserId = item.UserId,
            StallId = item.StallId,
            StallName = item.Stall?.Name ?? "",
            Title = item.Title,
            Description = item.Description,
            CategoryId = item.CategoryId,
            CategoryName = item.Category?.Name ?? "",
            Condition = item.Condition,
            Price = item.Price,
            AcceptOffers = item.AcceptOffers,
            MinOfferPrice = item.MinOfferPrice,
            OfferStep = item.OfferStep,
            EndDate = item.EndDate,
            Visibility = item.Visibility,
            Location = item.Location,
            CanShip = item.CanShip,
            IsSold = item.IsSold,
            SortOrder = item.SortOrder,
            CreatedAt = item.CreatedAt,
            UpdatedAt = item.UpdatedAt,
            BidCount = activeBids?.Count ?? 0,
            HighestBid = activeBids?.Count > 0 ? activeBids.Max(b => b.Amount) : null,
            Images = item.Images?.Select(img => new ItemImageDto
            {
                Id = img.Id,
                Url = img.Url,
                SortOrder = img.SortOrder,
                IsPrimary = img.IsPrimary
            }).ToList() ?? new(),
            Tags = item.ItemTags?.Select(it => it.Tag.Name).ToList() ?? new()
        };
    }
}
