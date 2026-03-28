namespace ManVaig.Api.Services;

public interface IImageService
{
    Task<string> UploadAvatarAsync(Stream imageStream, string fileName, Guid userId);
    Task<string> UploadItemImageAsync(Stream imageStream, string fileName, Guid itemId, Guid imageId);
    Task DeleteImageAsync(string publicId);
}
