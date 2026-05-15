namespace ManVaig.Api.Models;

public class Conversation
{
    public Guid Id { get; set; }

    public Guid User1Id { get; set; }
    public ApplicationUser User1 { get; set; } = default!;

    public Guid User2Id { get; set; }
    public ApplicationUser User2 { get; set; } = default!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastMessageAt { get; set; }

    public ICollection<Message> Messages { get; set; } = new List<Message>();
}
