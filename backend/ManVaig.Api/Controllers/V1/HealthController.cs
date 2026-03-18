using Microsoft.AspNetCore.Mvc;

namespace ManVaig.Api.Controllers.V1;

[ApiController]
[Route("api/v1/[controller]")]
public class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new { status = "healthy" });
}
