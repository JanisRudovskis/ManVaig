using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.Processing;

namespace ManVaig.Api.Services;

public class CloudinaryImageService : IImageService
{
    private readonly Cloudinary? _cloudinary;
    private readonly ILogger<CloudinaryImageService> _logger;

    public CloudinaryImageService(IConfiguration configuration, ILogger<CloudinaryImageService> logger)
    {
        _logger = logger;

        var cloudName = configuration["Cloudinary:CloudName"];
        var apiKey = configuration["Cloudinary:ApiKey"];
        var apiSecret = configuration["Cloudinary:ApiSecret"];

        if (!string.IsNullOrEmpty(cloudName) && !string.IsNullOrEmpty(apiKey) && !string.IsNullOrEmpty(apiSecret))
        {
            var account = new Account(cloudName, apiKey, apiSecret);
            _cloudinary = new Cloudinary(account);
        }
        else
        {
            _logger.LogWarning("Cloudinary credentials not configured. Avatar upload will not work.");
        }
    }

    public async Task<string> UploadAvatarAsync(Stream imageStream, string fileName, Guid userId)
    {
        if (_cloudinary == null)
            throw new InvalidOperationException("Cloudinary is not configured. Please set Cloudinary credentials in appsettings.");

        using var image = await Image.LoadAsync(imageStream);

        // Resize to 256x256 with center crop
        image.Mutate(x => x.Resize(new ResizeOptions
        {
            Size = new SixLabors.ImageSharp.Size(256, 256),
            Mode = ResizeMode.Crop,
            Position = AnchorPositionMode.Center
        }));

        // Encode as WebP
        using var outputStream = new MemoryStream();
        await image.SaveAsync(outputStream, new WebpEncoder { Quality = 80 });
        outputStream.Position = 0;

        // Upload to Cloudinary
        var uploadParams = new ImageUploadParams
        {
            File = new FileDescription($"{userId}.webp", outputStream),
            PublicId = $"manvaig/avatars/{userId}",
            Overwrite = true,
            Transformation = new Transformation().Quality("auto").FetchFormat("webp")
        };

        var result = await _cloudinary.UploadAsync(uploadParams);

        if (result.Error != null)
        {
            _logger.LogError("Cloudinary upload failed: {Error}", result.Error.Message);
            throw new InvalidOperationException($"Avatar upload failed: {result.Error.Message}");
        }

        _logger.LogInformation("Avatar uploaded for user {UserId}: {Url}", userId, result.SecureUrl);
        return result.SecureUrl.ToString();
    }

    public async Task<string> UploadItemImageAsync(Stream imageStream, string fileName, Guid itemId, Guid imageId)
    {
        if (_cloudinary == null)
            throw new InvalidOperationException("Cloudinary is not configured. Please set Cloudinary credentials in appsettings.");

        using var image = await Image.LoadAsync(imageStream);

        // Resize to max 800px on longest side, maintain aspect ratio
        var maxDimension = 800;
        if (image.Width > maxDimension || image.Height > maxDimension)
        {
            image.Mutate(x => x.Resize(new ResizeOptions
            {
                Size = new SixLabors.ImageSharp.Size(maxDimension, maxDimension),
                Mode = ResizeMode.Max
            }));
        }

        // Encode as WebP
        using var outputStream = new MemoryStream();
        await image.SaveAsync(outputStream, new WebpEncoder { Quality = 80 });
        outputStream.Position = 0;

        var uploadParams = new ImageUploadParams
        {
            File = new FileDescription($"{imageId}.webp", outputStream),
            PublicId = $"manvaig/items/{itemId}/{imageId}",
            Overwrite = true,
            Transformation = new Transformation().Quality("auto").FetchFormat("webp")
        };

        var result = await _cloudinary.UploadAsync(uploadParams);

        if (result.Error != null)
        {
            _logger.LogError("Cloudinary item image upload failed: {Error}", result.Error.Message);
            throw new InvalidOperationException($"Image upload failed: {result.Error.Message}");
        }

        _logger.LogInformation("Item image uploaded: {ItemId}/{ImageId} → {Url}", itemId, imageId, result.SecureUrl);
        return result.SecureUrl.ToString();
    }

    public async Task<string> UploadStallImageAsync(Stream imageStream, string fileName, Guid stallId, string imageType)
    {
        if (_cloudinary == null)
            throw new InvalidOperationException("Cloudinary is not configured. Please set Cloudinary credentials in appsettings.");

        using var image = await Image.LoadAsync(imageStream);

        // Thumbnail: 400x400 crop, Header: max 1200px wide, Background: max 1920px wide
        if (imageType == "thumbnail")
        {
            image.Mutate(x => x.Resize(new ResizeOptions
            {
                Size = new SixLabors.ImageSharp.Size(400, 400),
                Mode = ResizeMode.Crop,
                Position = AnchorPositionMode.Center
            }));
        }

        if (imageType == "header")
        {
            // Header: crop to 4:1 banner ratio (1200x300), center crop
            image.Mutate(x => x.Resize(new ResizeOptions
            {
                Size = new SixLabors.ImageSharp.Size(1200, 300),
                Mode = ResizeMode.Crop,
                Position = AnchorPositionMode.Center
            }));
        }
        else if (imageType == "background")
        {
            // Background: max 1920px wide, maintain aspect ratio
            if (image.Width > 1920)
            {
                image.Mutate(x => x.Resize(new ResizeOptions
                {
                    Size = new SixLabors.ImageSharp.Size(1920, 0),
                    Mode = ResizeMode.Max
                }));
            }
        }

        using var outputStream = new MemoryStream();
        await image.SaveAsync(outputStream, new WebpEncoder { Quality = 80 });
        outputStream.Position = 0;

        var uploadParams = new ImageUploadParams
        {
            File = new FileDescription($"{stallId}-{imageType}.webp", outputStream),
            PublicId = $"manvaig/stalls/{stallId}/{imageType}",
            Overwrite = true,
            Transformation = new Transformation().Quality("auto").FetchFormat("webp")
        };

        var result = await _cloudinary.UploadAsync(uploadParams);

        if (result.Error != null)
        {
            _logger.LogError("Cloudinary stall image upload failed: {Error}", result.Error.Message);
            throw new InvalidOperationException($"Stall image upload failed: {result.Error.Message}");
        }

        _logger.LogInformation("Stall {ImageType} uploaded: {StallId} → {Url}", imageType, stallId, result.SecureUrl);
        return result.SecureUrl.ToString();
    }

    public async Task DeleteImageAsync(string publicId)
    {
        if (_cloudinary == null)
            throw new InvalidOperationException("Cloudinary is not configured.");

        var result = await _cloudinary.DestroyAsync(new DeletionParams(publicId));

        if (result.Error != null)
        {
            _logger.LogWarning("Cloudinary delete failed for {PublicId}: {Error}", publicId, result.Error.Message);
        }
    }
}
