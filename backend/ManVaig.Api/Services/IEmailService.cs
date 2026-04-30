namespace ManVaig.Api.Services;

public interface IEmailService
{
    Task SendEmailConfirmationAsync(string toEmail, string confirmationLink, string language = "en");
    Task SendPasswordResetAsync(string toEmail, string resetLink, string language = "en");
}
