using DataControls.Api.Engine;
using DataControls.Api.Persistence;

namespace DataControls.Api.Health;

public sealed class HealthService(DqDbContext db, EngineClient engine)
{
    private const string Ok = "ok";
    private const string Unavailable = "unavailable";
    private const string Degraded = "degraded";

    private static readonly TimeSpan _probeTimeout = TimeSpan.FromSeconds(2);

    private static readonly string _version =
        typeof(HealthService).Assembly.GetName().Version?.ToString(3) ?? "0.0.0";

    /// <summary>Asks the database and the engine at the same time, each for two seconds at most.</summary>
    public async Task<HealthResponse> CheckAsync(CancellationToken cancellationToken)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(_probeTimeout);
        var databaseProbe = AnswersAsync(() => db.Database.CanConnectAsync(timeout.Token), cancellationToken);
        var engineProbe = AnswersAsync(() => IsEngineUpAsync(timeout.Token), cancellationToken);

        var database = await databaseProbe ? Ok : Unavailable;
        var engineState = await engineProbe ? Ok : Unavailable;
        var status = database == Ok && engineState == Ok ? Ok : Degraded;
        return new HealthResponse(status, database, engineState, _version);
    }

    private async Task<bool> IsEngineUpAsync(CancellationToken cancellationToken)
    {
        try
        {
            await engine.GetHealthAsync(cancellationToken);
            return true;
        }
        catch (EngineException)
        {
            return false;
        }
    }

    /// <summary>A probe that ran out of time did not answer; a request the client abandoned is still cancelled.</summary>
    private static async Task<bool> AnswersAsync(Func<Task<bool>> probe, CancellationToken requestAborted)
    {
        try
        {
            return await probe();
        }
        catch (OperationCanceledException) when (!requestAborted.IsCancellationRequested)
        {
            return false;
        }
    }
}
