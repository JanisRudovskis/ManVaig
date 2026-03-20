namespace ManVaig.Api.Services;

public interface IEmailService
{
    Task SendEmailConfirmationAsync(string toEmail, string confirmationLink);
}
