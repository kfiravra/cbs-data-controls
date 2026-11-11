using DataControls.Api.Engine;
using DataControls.Api.Glossary;
using DataControls.Api.Persistence;
using Microsoft.Extensions.Options;

namespace DataControls.Api.Hosting;

/// <summary>
/// Looks at the database and warms the glossary once at startup, in the background. It logs what it
/// found and nothing more: the host starts and stays up whether or not either answers.
/// </summary>
internal sealed class StartupProbe(
    IServiceScopeFactory scopes,
    IOptions<GlossaryOptions> options,
    ILogger<StartupProbe> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.WarmUpOnStart)
        {
            return;
        }

        await using var scope = scopes.CreateAsyncScope();
        try
        {
            var databaseUp = await scope.ServiceProvider.GetRequiredService<DqDbContext>().Database.CanConnectAsync(stoppingToken);
            logger.LogInformation("Startup probe: the dq database {DatabaseState}", databaseUp ? "answers" : "does not answer");

            var glossary = await scope.ServiceProvider.GetRequiredService<GlossaryService>().GetAsync(stoppingToken);
            logger.LogInformation("Startup probe: glossary {GlossaryVersion} loaded from the engine", glossary.Version);
        }
        catch (EngineException failure)
        {
            logger.LogWarning(failure, "Startup probe: the engine did not give a glossary ({Failure}); it is fetched on the first request that needs it", failure.Failure);
        }
        catch (Exception failure) when (!stoppingToken.IsCancellationRequested)
        {
            // A background service that throws stops the host, and this probe must never do that.
            logger.LogWarning(failure, "Startup probe failed");
        }
    }
}
