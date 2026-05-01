namespace ManVaig.Api.Models;

public class StallFeaturedItem
{
    public Guid StallId { get; set; }
    public Stall Stall { get; set; } = default!;

    public Guid ItemId { get; set; }
    public Item Item { get; set; } = default!;

    public int SortOrder { get; set; }
}
