using Microsoft.AspNetCore.Identity;

namespace ManVaig.Api.Models;

public class ApplicationUser : IdentityUser<Guid>
{
    public string? DisplayName { get; set; }
    public string? AvatarUrl { get; set; }
    public string? Bio { get; set; }
    public string? Location { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
