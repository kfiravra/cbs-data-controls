using DataControls.Api.Engine;
using DataControls.Api.Hosting;
using Microsoft.Extensions.Options;

namespace DataControls.Api.Glossary;

/// <summary>
/// The one glossary the api holds: fresh for the configured minutes, kept after that so it can be served
/// stale when a refresh fails. After a failed refresh the engine is left alone for a short while, so the
/// readers that queued behind it do not each wait for a failure of their own. Storing a glossary also
/// tells the request pipeline which languages exist.
/// </summary>
public sealed class GlossaryCache(TimeProvider time, IOptions<GlossaryOptions> options, SupportedLanguages languages) : IDisposable
{
    private static readonly TimeSpan _retryAfter = TimeSpan.FromSeconds(30);

    private readonly SemaphoreSlim _refresh = new(1, 1);
    private volatile Entry? _entry;
    private volatile FailedRefresh? _failedRefresh;

    /// <summary>The held copy, whatever its age; null before the first fetch.</summary>
    public EngineGlossary? Held => _entry?.Glossary;

    /// <summary>The held copy while it is fresh.</summary>
    public EngineGlossary? Fresh
    {
        get
        {
            var entry = _entry;
            var lifetime = TimeSpan.FromMinutes(options.Value.CacheMinutes);
            return entry is not null && time.GetUtcNow() - entry.FetchedAt < lifetime ? entry.Glossary : null;
        }
    }

    /// <summary>The failure of the last refresh, while it is too recent to ask the engine again.</summary>
    public EngineException? RecentFailure
    {
        get
        {
            var failed = _failedRefresh;
            return failed is not null && time.GetUtcNow() - failed.At < _retryAfter ? failed.Failure : null;
        }
    }

    public void Store(EngineGlossary glossary)
    {
        _entry = new Entry(glossary, time.GetUtcNow());
        _failedRefresh = null;
        languages.Replace(glossary.Languages, glossary.DefaultLanguage);
    }

    public void RecordFailure(EngineException failure) => _failedRefresh = new FailedRefresh(failure, time.GetUtcNow());

    /// <summary>One refresh at a time: the caller holds the turn until it disposes the result.</summary>
    public async Task<IDisposable> WaitForRefreshTurnAsync(CancellationToken cancellationToken)
    {
        await _refresh.WaitAsync(cancellationToken);
        return new Turn(_refresh);
    }

    public void Dispose() => _refresh.Dispose();

    private sealed record Entry(EngineGlossary Glossary, DateTimeOffset FetchedAt);

    private sealed record FailedRefresh(EngineException Failure, DateTimeOffset At);

    private sealed class Turn(SemaphoreSlim semaphore) : IDisposable
    {
        public void Dispose() => semaphore.Release();
    }
}
