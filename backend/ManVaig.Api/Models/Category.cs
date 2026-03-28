namespace ManVaig.Api.Models;

public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = default!;
    public int SortOrder { get; set; }

    public ICollection<Item> Items { get; set; } = new List<Item>();
}
