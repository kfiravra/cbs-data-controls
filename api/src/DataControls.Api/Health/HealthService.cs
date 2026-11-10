using DataControls.Api.Persistence;

namespace DataControls.Api.Health;

public sealed class HealthService(DqDbContext db)
{
    private const string Ok = "ok";
    private const string Unavailable = "unavailable";
    private const string Degraded = "degraded";

    private static readonly TimeSpan _probeTimeout = TimeSpan.FromSeconds(2);

    private static readonly string _version =
        typeof(HealthService).Assembly.GetName().Version?.ToString(3) ?? "0.0.0";

    public async Task<HealthResponse> CheckAsync(CancellationToken cancellationToken)
    {
        var database = await IsDatabaseUpAsync(cancellationToken) ? Ok : Unavailable;
        // The engine probe arrives with the engine client.
        var engine = Unavailable;
        var status = database == Ok && engine == Ok ? Ok : Degraded;
        return new HealthResponse(status, database, engine, _version);
    }

    private async Task<bool> IsDatabaseUpAsync(CancellationToken cancellationToken)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(_probeTimeout);
        try
        {
            return await db.Database.CanConnectAsync(timeout.Token);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return false;
        }
    }
}
