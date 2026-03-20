using Resend;

namespace ManVaig.Api.Services;

public class ResendEmailService : IEmailService
{
    private readonly IResend _resend;
    private readonly string _fromEmail;
    private readonly ILogger<ResendEmailService> _logger;

    public ResendEmailService(IResend resend, IConfiguration config, ILogger<ResendEmailService> logger)
    {
        _resend = resend;
        _fromEmail = config["Resend:FromEmail"] ?? "noreply@manvaig.com";
        _logger = logger;
    }

    public async Task SendEmailConfirmationAsync(string toEmail, string confirmationLink)
    {
        try
        {
            var message = new EmailMessage
            {
                From = _fromEmail,
                To = { toEmail },
                Subject = "ManVaig — Confirm your email",
                HtmlBody = $"""
                    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                        <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 16px;">Welcome to ManVaig!</h1>
                        <p style="color: #555; margin-bottom: 24px;">Please confirm your email address by clicking the button below:</p>
                        <a href="{confirmationLink}"
                           style="display: inline-block; background: #7c6af7; color: white; padding: 12px 32px;
                                  border-radius: 8px; text-decoration: none; font-weight: 600;">
                            Confirm Email
                        </a>
                        <p style="color: #888; margin-top: 24px; font-size: 14px;">
                            If you didn't create a ManVaig account, you can safely ignore this email.
                        </p>
                    </div>
                    """
            };

            await _resend.EmailSendAsync(message);
            _logger.LogInformation("Confirmation email sent to {Email}", toEmail);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send confirmation email to {Email}", toEmail);
            // Don't throw — registration should still succeed even if email fails
        }
    }
}
