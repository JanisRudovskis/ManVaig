using ManVaig.Api.Data;
using ManVaig.Api.Models.Dto;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ManVaig.Api.Controllers.V1;

[ApiController]
[Route("api/v1/tags")]
public class TagsController : ControllerBase
{
    private readonly AppDbContext _db;

    public TagsController(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Autocomplete search for tags (top 10 matches).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> SearchTags([FromQuery] string? q)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Length < 1)
            return Ok(Array.Empty<TagDto>());

        var normalized = q.Trim().ToLowerInvariant();

        var tags = await _db.Tags
            .Where(t => t.Name.Contains(normalized))
            .OrderBy(t => t.Name)
            .Take(10)
            .Select(t => new TagDto
            {
                Id = t.Id,
                Name = t.Name
            })
            .ToListAsync();

        return Ok(tags);
    }
}
