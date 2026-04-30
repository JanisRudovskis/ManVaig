using System.Collections.Concurrent;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;
using ManVaig.Api.Data;
using ManVaig.Api.Models;
using ManVaig.Api.Models.Dto;
using ManVaig.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace ManVaig.Api.Controllers.V1;

[ApiController]
[Route("api/v1/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly IEmailService _emailService;

    // Only letters, numbers, hyphens, underscores. 3-30 chars.
    private static readonly Regex DisplayNameRegex = new(@"^[a-zA-Z0-9_-]{3,30}$", RegexOptions.Compiled);

    // Rate limit: 2 minutes between emails
    private static readonly TimeSpan EmailCooldown = TimeSpan.FromMinutes(2);

    // In-memory rate limit for unauthenticated forgot-password (keyed by normalized email)
    private static readonly ConcurrentDictionary<string, DateTime> ForgotPasswordRateLimit = new();

    public AuthController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        AppDbContext db,
        IConfiguration config,
        IEmailService emailService)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _db = db;
        _config = config;
        _emailService = emailService;
    }

    [HttpGet("check-name")]
    public async Task<IActionResult> CheckName([FromQuery] string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            return Ok(new { available = false, reason = "REQUIRED" });

        if (!DisplayNameRegex.IsMatch(name))
            return Ok(new { available = false, reason = "INVALID_FORMAT" });

        var taken = await _db.Users.AnyAsync(u => u.DisplayName!.ToLower() == name.ToLower());
        return Ok(new { available = !taken, reason = taken ? "TAKEN" : (string?)null });
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        // Validate display name format
        if (!DisplayNameRegex.IsMatch(request.DisplayName))
            return BadRequest(new { errors = new[] { "DISPLAY_NAME_INVALID_FORMAT" } });

        // Check display name uniqueness (case-insensitive)
        var nameTaken = await _db.Users.AnyAsync(u => u.DisplayName!.ToLower() == request.DisplayName.ToLower());
        if (nameTaken)
            return BadRequest(new { errors = new[] { "DISPLAY_NAME_TAKEN" } });

        var user = new ApplicationUser
        {
            UserName = request.Email,
            Email = request.Email,
            DisplayName = request.DisplayName,
            CreatedAt = DateTime.UtcNow,
            LastEmailSentAt = DateTime.UtcNow
        };

        var result = await _userManager.CreateAsync(user, request.Password);

        if (!result.Succeeded)
            return BadRequest(new { errors = result.Errors.Select(e => e.Description) });

        // Generate email confirmation token and send email
        var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
        var frontendUrl = GetFrontendUrl();
        var confirmationLink = $"{frontendUrl}/confirm-email?userId={user.Id}&token={Uri.EscapeDataString(token)}";
        await _emailService.SendEmailConfirmationAsync(user.Email!, confirmationLink, request.Language ?? "en");

        return Ok(GenerateAuthResponse(user));
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        // Support login by email or username
        var login = request.Login?.Trim();
        if (string.IsNullOrEmpty(login))
            return Unauthorized(new { error = "Invalid credentials." });

        ApplicationUser? user;
        if (login.Contains('@'))
            user = await _userManager.FindByEmailAsync(login);
        else
            user = await _db.Users.FirstOrDefaultAsync(u => u.DisplayName!.ToLower() == login.ToLower());

        if (user == null)
            return Unauthorized(new { error = "Invalid credentials." });

        if (!user.IsActive)
            return Unauthorized(new { error = "Account is deactivated." });

        var result = await _signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: false);
        if (!result.Succeeded)
            return Unauthorized(new { error = "Invalid credentials." });

        return Ok(GenerateAuthResponse(user));
    }

    [HttpPost("confirm-email")]
    public async Task<IActionResult> ConfirmEmail([FromBody] ConfirmEmailRequest request)
    {
        var user = await _userManager.FindByIdAsync(request.UserId);
        if (user == null)
            return BadRequest(new { error = "Invalid confirmation link." });

        var result = await _userManager.ConfirmEmailAsync(user, request.Token);
        if (!result.Succeeded)
            return BadRequest(new { error = "Invalid or expired confirmation link." });

        return Ok(new { message = "Email confirmed successfully." });
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        var normalizedEmail = request.Email.Trim().ToUpperInvariant();

        // In-memory rate limit for unauthenticated endpoint
        if (ForgotPasswordRateLimit.TryGetValue(normalizedEmail, out var lastSent))
        {
            var remaining = EmailCooldown - (DateTime.UtcNow - lastSent);
            if (remaining > TimeSpan.Zero)
                // Still return 200 to prevent email enumeration, but don't send
                return Ok(new { message = "If an account with that email exists, a reset link has been sent." });
        }

        // Always return 200 to prevent email enumeration
        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user != null && user.IsActive)
        {
            var token = await _userManager.GeneratePasswordResetTokenAsync(user);
            var frontendUrl = GetFrontendUrl();
            var resetLink = $"{frontendUrl}/reset-password?userId={user.Id}&token={Uri.EscapeDataString(token)}";
            await _emailService.SendPasswordResetAsync(user.Email!, resetLink, request.Language ?? "en");

            ForgotPasswordRateLimit[normalizedEmail] = DateTime.UtcNow;
        }

        return Ok(new { message = "If an account with that email exists, a reset link has been sent." });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        var user = await _userManager.FindByIdAsync(request.UserId);
        if (user == null)
            return BadRequest(new { error = "Invalid or expired reset link." });

        var result = await _userManager.ResetPasswordAsync(user, request.Token, request.NewPassword);
        if (!result.Succeeded)
        {
            var errors = result.Errors.Select(e => e.Description).ToList();
            return BadRequest(new { error = errors.FirstOrDefault() ?? "Password reset failed.", errors });
        }

        return Ok(new { message = "Password has been reset successfully." });
    }

    [HttpPost("resend-confirmation")]
    [Authorize]
    public async Task<IActionResult> ResendConfirmation([FromQuery] string? language = "en")
    {
        var user = await GetCurrentUser();
        if (user == null) return Unauthorized();

        if (user.EmailConfirmed)
            return BadRequest(new { error = "EMAIL_ALREADY_CONFIRMED" });

        // Rate limit
        var rateLimitResult = CheckEmailRateLimit(user);
        if (rateLimitResult != null) return rateLimitResult;

        var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
        var frontendUrl = GetFrontendUrl();
        var confirmationLink = $"{frontendUrl}/confirm-email?userId={user.Id}&token={Uri.EscapeDataString(token)}";
        await _emailService.SendEmailConfirmationAsync(user.Email!, confirmationLink, language ?? "en");

        await UpdateLastEmailSent(user);

        return Ok(new { message = "Confirmation email sent." });
    }

    [HttpPost("change-email")]
    [Authorize]
    public async Task<IActionResult> ChangeEmail([FromBody] ChangeEmailRequest request)
    {
        var user = await GetCurrentUser();
        if (user == null) return Unauthorized();

        // Verify password
        var passwordValid = await _userManager.CheckPasswordAsync(user, request.Password);
        if (!passwordValid)
            return BadRequest(new { error = "INVALID_PASSWORD" });

        var newEmail = request.NewEmail.Trim();

        // Check if same as current
        if (string.Equals(user.Email, newEmail, StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "SAME_EMAIL" });

        // Check if taken by another user
        var existing = await _userManager.FindByEmailAsync(newEmail);
        if (existing != null && existing.Id != user.Id)
            return BadRequest(new { error = "EMAIL_TAKEN" });

        // Rate limit
        var rateLimitResult = CheckEmailRateLimit(user);
        if (rateLimitResult != null) return rateLimitResult;

        // Update email — marks as unconfirmed
        user.Email = newEmail;
        user.NormalizedEmail = newEmail.ToUpperInvariant();
        user.UserName = newEmail;
        user.NormalizedUserName = newEmail.ToUpperInvariant();
        user.EmailConfirmed = false;
        await _userManager.UpdateAsync(user);

        // Send confirmation to new email
        var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
        var frontendUrl = GetFrontendUrl();
        var confirmationLink = $"{frontendUrl}/confirm-email?userId={user.Id}&token={Uri.EscapeDataString(token)}";
        await _emailService.SendEmailConfirmationAsync(newEmail, confirmationLink, request.Language ?? "en");

        await UpdateLastEmailSent(user);

        // Return new JWT with updated email + emailConfirmed=false
        return Ok(GenerateAuthResponse(user));
    }

    // --- Helper methods ---

    private async Task<ApplicationUser?> GetCurrentUser()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        if (userId == null) return null;
        return await _userManager.FindByIdAsync(userId);
    }

    private string GetFrontendUrl()
    {
        return _config["Cors:AllowedOrigins"]?.Split(",").FirstOrDefault()
            ?? _config.GetSection("Cors:AllowedOrigins").Get<string[]>()?.FirstOrDefault()
            ?? "http://localhost:3000";
    }

    private IActionResult? CheckEmailRateLimit(ApplicationUser user)
    {
        if (user.LastEmailSentAt.HasValue)
        {
            var remaining = EmailCooldown - (DateTime.UtcNow - user.LastEmailSentAt.Value);
            if (remaining > TimeSpan.Zero)
                return StatusCode(429, new
                {
                    error = "RATE_LIMITED",
                    retryAfter = (int)Math.Ceiling(remaining.TotalSeconds)
                });
        }
        return null;
    }

    private async Task UpdateLastEmailSent(ApplicationUser user)
    {
        user.LastEmailSentAt = DateTime.UtcNow;
        await _userManager.UpdateAsync(user);
    }

    private AuthResponse GenerateAuthResponse(ApplicationUser user)
    {
        var expirationDays = _config.GetValue<int>("Jwt:ExpirationDays");
        var expiresAt = DateTime.UtcNow.AddDays(expirationDays);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email!),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new("displayName", user.DisplayName ?? ""),
            new("emailConfirmed", user.EmailConfirmed.ToString().ToLower()),
        };

        if (!string.IsNullOrEmpty(user.AvatarUrl))
            claims.Add(new Claim("avatarUrl", user.AvatarUrl));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Secret"]!));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: expiresAt,
            signingCredentials: credentials);

        return new AuthResponse
        {
            Token = new JwtSecurityTokenHandler().WriteToken(token),
            ExpiresAt = expiresAt,
            UserId = user.Id,
            Email = user.Email!,
            DisplayName = user.DisplayName ?? "",
            EmailConfirmed = user.EmailConfirmed,
            AvatarUrl = user.AvatarUrl
        };
    }
}
