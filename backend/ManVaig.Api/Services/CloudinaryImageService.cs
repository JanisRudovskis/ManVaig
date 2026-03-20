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
}
