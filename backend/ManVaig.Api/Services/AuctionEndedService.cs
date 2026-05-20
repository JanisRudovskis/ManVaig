using ManVaig.Api.Data;
using ManVaig.Api.Models.Enums;
using Microsoft.EntityFrameworkCore;

namespace ManVaig.Api.Services;

public class AuctionEndedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<AuctionEndedService> _logger;
    private static readonly SemaphoreSlim _tickLock = new(1, 1);

    public AuctionEndedService(IServiceScopeFactory scopeFactory, ILogger<AuctionEndedService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Wait briefly on startup to let the app fully initialize
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            if (!await _tickLock.WaitAsync(0, stoppingToken))
            {
                await Task.Delay(TimeSpan.FromSeconds(60), stoppingToken);
                continue;
            }
            try
            {
                await using var scope = _scopeFactory.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();

                // Find items where EndDate has passed and no AuctionEnded notification exists
                var endedItems = await db.Items
                    .Where(i => i.EndDate != null
                        && i.EndDate < DateTime.UtcNow
                        && i.AcceptOffers
                        && !i.IsSold
                        && !db.Notifications.Any(n =>
                            n.ItemId == i.Id
                            && n.UserId == i.UserId
                            && n.Type == NotificationType.AuctionEnded))
                    .Select(i => new { i.Id, i.UserId })
                    .Take(50)
                    .ToListAsync(stoppingToken);

                foreach (var item in endedItems)
                {
                    // Auto-deny any pending InstantBuy bids (timer won, IB lost)
                    var pendingIbs = await db.Bids
                        .Where(b => b.ItemId == item.Id && b.Status == BidStatus.InstantBuy)
                        .ToListAsync(stoppingToken);
                    foreach (var ib in pendingIbs)
                    {
                        ib.Status = BidStatus.Denied;
                        ib.DenyReason = "auction_ended";
                        ib.DeniedAt = DateTime.UtcNow;
                        await notificationService.NotifyInstantBuyDeclined(ib.UserId, item.Id);
                    }

                    // Find winning bid (highest active)
                    var winningBid = await db.Bids
                        .Where(b => b.ItemId == item.Id && b.Status == BidStatus.Active)
                        .OrderByDescending(b => b.Amount)
                        .FirstOrDefaultAsync(stoppingToken);

                    if (winningBid != null)
                    {
                        // Mark item as sold
                        var dbItem = await db.Items.FindAsync(new object[] { item.Id }, stoppingToken);
                        if (dbItem != null)
                        {
                            dbItem.IsSold = true;
                            await db.SaveChangesAsync(stoppingToken);
                        }
                    }
                    else if (pendingIbs.Count > 0)
                    {
                        await db.SaveChangesAsync(stoppingToken);
                    }

                    // Notify all subscribers that auction ended (with winner info if any)
                    await notificationService.NotifyAuctionEndedToSubscribers(
                        item.Id, item.UserId,
                        winningBid?.UserId, winningBid?.Id);
                }

                if (endedItems.Count > 0)
                    _logger.LogInformation("AuctionEndedService: processed {Count} ended auctions", endedItems.Count);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "AuctionEndedService tick failed");
            }
            finally
            {
                _tickLock.Release();
            }

            await Task.Delay(TimeSpan.FromSeconds(60), stoppingToken);
        }
    }
}
