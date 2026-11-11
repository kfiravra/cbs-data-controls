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
    /// copy is served stale; with no copy the failure goes to the caller. Either way the engine is not
    /// asked again until a short while has passed.
    /// </summary>
    public async Task<EngineGlossary> GetAsync(CancellationToken cancellationToken)
    {
        if (Usable() is { } usable)
        {
            return usable;
        }

        using (await cache.WaitForRefreshTurnAsync(cancellationToken))
        {
            // Whoever held the turn before may have fetched it, or failed a moment ago.
            if (Usable() is { } settledMeanwhile)
            {
                return settledMeanwhile;
            }

            if (cache.RecentFailure is { } recentFailure)
            {
                throw recentFailure;
            }

            try
            {
                var glossary = await engine.GetGlossaryAsync(cancellationToken);
                cache.Store(glossary);
                return glossary;
            }
            catch (EngineException failure)
            {
                cache.RecordFailure(failure);
                if (cache.Held is not { } stale)
                {
                    throw;
                }

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

    /// <summary>
    /// An entity's identifying field keys, in the glossary's order, or null when the glossary does not know
    /// the entity. <paramref name="reportedVersion"/> is the version the engine just named in a run: a held
    /// copy of another version is dropped first.
    /// </summary>
    public async Task<IReadOnlyList<string>?> IdentifyingFieldsAsync(string entity, string reportedVersion, CancellationToken cancellationToken)
    {
        cache.DropUnless(reportedVersion);
        return (await GetAsync(cancellationToken)).IdentifyingFields.GetValueOrDefault(entity);
    }

    /// <summary>
    /// The entity keys in the order of their plural labels in <paramref name="language"/>, for a list that is
    /// sorted by what the user reads and not by the key. Null when no glossary can be read: the caller then
    /// has only the keys to sort by.
    /// </summary>
    public async Task<IReadOnlyList<string>?> EntityKeysByLabelAsync(string language, CancellationToken cancellationToken)
    {
        try
        {
            var labels = (await GetAsync(cancellationToken)).EntityLabels;
            return [.. labels
                .OrderBy(entity => entity.Value.GetValueOrDefault(language, entity.Key), StringComparer.OrdinalIgnoreCase)
                .ThenBy(entity => entity.Key, StringComparer.Ordinal)
                .Select(entity => entity.Key)];
        }
        catch (EngineException)
        {
            return null;
        }
    }

    /// <summary>The fresh copy, or the held one while a failed refresh is too recent to repeat.</summary>
    private EngineGlossary? Usable() => cache.Fresh ?? (cache.RecentFailure is null ? null : cache.Held);
}
