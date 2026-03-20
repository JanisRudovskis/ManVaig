namespace ManVaig.Api.Models;

[Flags]
public enum CommunicationChannels
{
    None = 0,
    WhatsApp = 1,
    Telegram = 2,
    // Future: Viber = 4, Signal = 8
}
