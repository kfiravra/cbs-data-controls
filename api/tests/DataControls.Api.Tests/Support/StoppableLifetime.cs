using Microsoft.Extensions.Hosting;

namespace DataControls.Api.Tests.Support;

/// <summary>
/// A host lifetime whose "stopping" a test can signal without stopping the test host. The real one cannot
/// be used for that: the test server does not drain requests the way Kestrel does, it is torn down at once.
/// </summary>
internal sealed class StoppableLifetime : IHostApplicationLifetime, IDisposable
{
    private readonly CancellationTokenSource _stopping = new();

    public CancellationToken ApplicationStarted => CancellationToken.None;

    public CancellationToken ApplicationStopping => _stopping.Token;

    public CancellationToken ApplicationStopped => CancellationToken.None;

    public void StopApplication() => _stopping.Cancel();

    public void Dispose() => _stopping.Dispose();
}
