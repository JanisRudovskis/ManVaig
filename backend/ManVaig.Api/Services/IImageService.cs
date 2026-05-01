namespace ManVaig.Api.Services;

public interface IImageService
{
    Task<string> UploadAvatarAsync(Stream imageStream, string fileName, Guid userId);
    Task<string> UploadItemImageAsync(Stream imageStream, string fileName, Guid itemId, Guid imageId);
    Task<string> UploadStallImageAsync(Stream imageStream, string fileName, Guid stallId, string imageType);
    Task DeleteImageAsync(string publicId);
}
