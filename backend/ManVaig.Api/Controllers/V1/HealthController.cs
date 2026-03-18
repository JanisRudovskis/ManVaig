using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ManVaig.Api.Controllers.V1;

[ApiController]
[Route("api/v1/[controller]")]
public class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new { status = "healthy" });

    [Authorize]
    [HttpGet("protected")]
    public IActionResult GetProtected() => Ok(new { status = "authenticated", user = User.Identity?.Name });
}
