namespace DataControls.Api.Engine;

public sealed class EngineOptions
{
    public const string Section = "Engine";

    public string BaseUrl { get; set; } = "http://localhost:8000";

    /// <summary>
    /// How long one call may take. It stays above the engine's worst case for a run: two statements of
    /// 30 seconds each.
    /// </summary>
    public TimeSpan AttemptTimeout { get; set; } = TimeSpan.FromSeconds(75);

    /// <summary>The calls the circuit breaker must see before it may open.</summary>
    public int BreakerMinimumThroughput { get; set; } = 5;

    public TimeSpan BreakerBreakDuration { get; set; } = TimeSpan.FromSeconds(15);
}
