using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using ManVaig.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace ManVaig.Api.Middleware;

/// <summary>
/// Updates the authenticated user's LastSeenAt timestamp.
/// Throttled: only writes to DB if more than 5 minutes since last update.
/// </summary>
public class LastSeenMiddleware
{
    private readonly RequestDelegate _next;

    public LastSeenMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, AppDbContext db)
    {
        // Fire-and-forget style: update after the response starts processing
        // but don't block the request pipeline
        await _next(context);

        if (context.User.Identity?.IsAuthenticated != true) return;

        var userIdStr = context.User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? context.User.FindFirstValue(JwtRegisteredClaimNames.Sub);

        if (!Guid.TryParse(userIdStr, out var userId)) return;

        try
        {
            // Throttle: only update if LastSeenAt is null or older than 5 minutes
            var now = DateTime.UtcNow;
            var threshold = now.AddMinutes(-5);

            var updated = await db.Users
                .Where(u => u.Id == userId && (u.LastSeenAt == null || u.LastSeenAt < threshold))
                .ExecuteUpdateAsync(s => s.SetProperty(u => u.LastSeenAt, now));
        }
        catch
        {
            // Non-critical — don't let tracking failures break requests
        }
    }
}
