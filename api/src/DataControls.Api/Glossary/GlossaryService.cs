using DataControls.Api.Engine;
using DataControls.Api.Hosting;

namespace DataControls.Api.Glossary;

public sealed class GlossaryService(
    GlossaryCache cache,
    EngineClient engine,
    RequestContextAccessor requests,
    ILogger<GlossaryService> logger)
{
    /// <summary>
    /// The glossary: the cached copy while it is fresh, else the engine's. When the engine fails, the held
    /// copy is served stale; with no copy the failure goes to the caller.
    /// </summary>
    public async Task<EngineGlossary> GetAsync(CancellationToken cancellationToken)
    {
        if (cache.Fresh is { } fresh)
        {
            return fresh;
        }

        using (await cache.WaitForRefreshTurnAsync(cancellationToken))
        {
            if (cache.Fresh is { } refreshedMeanwhile)
            {
                return refreshedMeanwhile;
            }

            try
            {
                var glossary = await engine.GetGlossaryAsync(cancellationToken);
                cache.Store(glossary);
                return glossary;
            }
            catch (EngineException failure) when (cache.Held is { } stale)
            {
                logger.LogWarning(
                    failure,
                    "The glossary could not be refreshed ({Failure}); serving the held version {GlossaryVersion} {CorrelationId}",
                    failure.Failure,
                    stale.Version,
                    requests.Current.CorrelationId);
                return stale;
            }
        }
    }
}
