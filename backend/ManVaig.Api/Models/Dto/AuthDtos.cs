using System.ComponentModel.DataAnnotations;

namespace ManVaig.Api.Models.Dto;

public class RegisterRequest
{
    [Required, EmailAddress]
    public string Email { get; set; } = default!;

    [Required, MinLength(8)]
    public string Password { get; set; } = default!;

    [Required, MaxLength(100)]
    public string DisplayName { get; set; } = default!;

    public string? Language { get; set; }
}

public class LoginRequest
{
    [Required]
    public string Login { get; set; } = default!;

    [Required]
    public string Password { get; set; } = default!;
}

public class AuthResponse
{
    public string Token { get; set; } = default!;
    public DateTime ExpiresAt { get; set; }
    public Guid UserId { get; set; }
    public string Email { get; set; } = default!;
    public string DisplayName { get; set; } = default!;
    public bool EmailConfirmed { get; set; }
    public string? AvatarUrl { get; set; }
}

public class ConfirmEmailRequest
{
    public string UserId { get; set; } = default!;
    public string Token { get; set; } = default!;
}

public class ForgotPasswordRequest
{
    [Required, EmailAddress]
    public string Email { get; set; } = default!;

    public string? Language { get; set; }
}

public class ResetPasswordRequest
{
    [Required]
    public string UserId { get; set; } = default!;

    [Required]
    public string Token { get; set; } = default!;

    [Required, MinLength(8)]
    public string NewPassword { get; set; } = default!;
}

public class ChangeEmailRequest
{
    [Required, EmailAddress]
    public string NewEmail { get; set; } = default!;

    [Required]
    public string Password { get; set; } = default!;

    public string? Language { get; set; }
}
