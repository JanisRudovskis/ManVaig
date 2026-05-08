namespace ManVaig.Api.Models;

[Flags]
public enum CommunicationChannels
{
    None = 0,
    WhatsApp = 1,
    Telegram = 2,
    ShowEmail = 4,
    ShowPhone = 8,
}
