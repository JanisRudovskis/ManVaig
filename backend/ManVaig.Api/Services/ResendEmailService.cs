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

    private static bool IsLatvian(string language) =>
        language.StartsWith("lv", StringComparison.OrdinalIgnoreCase);

    public async Task SendEmailConfirmationAsync(string toEmail, string confirmationLink, string language = "en")
    {
        var lv = IsLatvian(language);

        var subject = lv
            ? "ManVaig — Apstipriniet savu e-pastu"
            : "ManVaig — Confirm your email";

        var heading = lv
            ? "Laipni lūgti ManVaig!"
            : "Welcome to ManVaig!";

        var body = lv
            ? "Lūdzu, apstipriniet savu e-pasta adresi, noklikšķinot uz zemāk esošās pogas:"
            : "Please confirm your email address by clicking the button below:";

        var buttonText = lv
            ? "Apstiprināt e-pastu"
            : "Confirm Email";

        var footer = lv
            ? "Ja jūs neesat izveidojuši ManVaig kontu, varat droši ignorēt šo e-pastu."
            : "If you didn't create a ManVaig account, you can safely ignore this email.";

        try
        {
            var message = new EmailMessage
            {
                From = _fromEmail,
                To = { toEmail },
                Subject = subject,
                HtmlBody = $"""
                    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                        <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 16px;">{heading}</h1>
                        <p style="color: #555; margin-bottom: 24px;">{body}</p>
                        <a href="{confirmationLink}"
                           style="display: inline-block; background: #7c6af7; color: white; padding: 12px 32px;
                                  border-radius: 8px; text-decoration: none; font-weight: 600;">
                            {buttonText}
                        </a>
                        <p style="color: #888; margin-top: 24px; font-size: 14px;">
                            {footer}
                        </p>
                    </div>
                    """
            };

            await _resend.EmailSendAsync(message);
            _logger.LogInformation("Confirmation email sent to {Email} (lang={Language})", toEmail, language);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send confirmation email to {Email}", toEmail);
            // Don't throw — registration should still succeed even if email fails
        }
    }

    public async Task SendPasswordResetAsync(string toEmail, string resetLink, string language = "en")
    {
        var lv = IsLatvian(language);

        var subject = lv
            ? "ManVaig — Atjaunojiet savu paroli"
            : "ManVaig — Reset your password";

        var heading = lv
            ? "Atjaunojiet savu paroli"
            : "Reset your password";

        var body = lv
            ? "Mēs saņēmām pieprasījumu atjaunot jūsu ManVaig konta paroli. Noklikšķiniet uz zemāk esošās pogas, lai izvēlētos jaunu paroli:"
            : "We received a request to reset your ManVaig account password. Click the button below to choose a new password:";

        var buttonText = lv
            ? "Atjaunot paroli"
            : "Reset Password";

        var footer = lv
            ? "Šī saite būs derīga 24 stundas. Ja jūs nepieprasījāt paroles atjaunošanu, varat droši ignorēt šo e-pastu."
            : "This link will expire in 24 hours. If you didn't request a password reset, you can safely ignore this email.";

        try
        {
            var message = new EmailMessage
            {
                From = _fromEmail,
                To = { toEmail },
                Subject = subject,
                HtmlBody = $"""
                    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                        <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 16px;">{heading}</h1>
                        <p style="color: #555; margin-bottom: 24px;">{body}</p>
                        <a href="{resetLink}"
                           style="display: inline-block; background: #7c6af7; color: white; padding: 12px 32px;
                                  border-radius: 8px; text-decoration: none; font-weight: 600;">
                            {buttonText}
                        </a>
                        <p style="color: #888; margin-top: 24px; font-size: 14px;">
                            {footer}
                        </p>
                    </div>
                    """
            };

            await _resend.EmailSendAsync(message);
            _logger.LogInformation("Password reset email sent to {Email} (lang={Language})", toEmail, language);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send password reset email to {Email}", toEmail);
            // Don't throw — always return 200 to prevent email enumeration
        }
    }
}
