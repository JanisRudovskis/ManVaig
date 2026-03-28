namespace ManVaig.Api.Models;

public class ItemTag
{
    public Guid ItemId { get; set; }
    public Item Item { get; set; } = default!;

    public int TagId { get; set; }
    public Tag Tag { get; set; } = default!;
}
