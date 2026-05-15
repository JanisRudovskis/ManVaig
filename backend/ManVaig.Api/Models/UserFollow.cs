namespace ManVaig.Api.Models;

public class UserFollow
{
    public Guid FollowerId { get; set; }
    public ApplicationUser Follower { get; set; } = null!;

    public Guid FolloweeId { get; set; }
    public ApplicationUser Followee { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
