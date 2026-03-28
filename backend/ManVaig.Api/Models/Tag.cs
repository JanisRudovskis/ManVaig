namespace ManVaig.Api.Models;

public class Tag
{
    public int Id { get; set; }
    public string Name { get; set; } = default!;

    public ICollection<ItemTag> ItemTags { get; set; } = new List<ItemTag>();
}
