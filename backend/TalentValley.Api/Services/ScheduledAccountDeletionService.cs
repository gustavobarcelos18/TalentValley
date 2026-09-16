using Microsoft.Extensions.DependencyInjection;

namespace TalentValley.Api.Services;

public sealed class ScheduledAccountDeletionService(IServiceScopeFactory scopes,
    ILogger<ScheduledAccountDeletionService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var now = DateTimeOffset.UtcNow;
                await scope.ServiceProvider.GetRequiredService<AdminAlunoService>().DeleteExpiredAsync(now, stoppingToken);
                await scope.ServiceProvider.GetRequiredService<AdminRecrutadorService>().DeleteExpiredAsync(now, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception exception) { logger.LogError(exception, "Failed to delete expired blocked accounts."); }
            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
        }
    }
}
