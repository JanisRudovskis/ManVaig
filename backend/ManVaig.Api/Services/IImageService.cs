namespace ManVaig.Api.Services;

public interface IImageService
{
    Task<string> UploadAvatarAsync(Stream imageStream, string fileName, Guid userId);
}
