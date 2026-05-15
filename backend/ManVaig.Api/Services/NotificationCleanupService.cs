using ManVaig.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace ManVaig.Api.Services;

public class NotificationCleanupService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<NotificationCleanupService> _logger;

    public NotificationCleanupService(IServiceScopeFactory scopeFactory, ILogger<NotificationCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(TimeSpan.FromHours(24), stoppingToken);

            try
            {
                await using var scope = _scopeFactory.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var cutoff = DateTime.UtcNow.AddDays(-90);

                int deleted;
                do
                {
                    var batch = await db.Notifications
                        .Where(n => n.CreatedAt < cutoff)
                        .Take(1000)
                        .ToListAsync(stoppingToken);

                    deleted = batch.Count;
                    if (deleted > 0)
                    {
                        db.Notifications.RemoveRange(batch);
                        await db.SaveChangesAsync(stoppingToken);
                        _logger.LogInformation("Notification cleanup: deleted {Count} old notifications", deleted);
                    }
                } while (deleted == 1000 && !stoppingToken.IsCancellationRequested);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Notification cleanup failed");
            }
        }
    }
}
