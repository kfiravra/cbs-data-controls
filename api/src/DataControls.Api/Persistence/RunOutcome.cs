namespace DataControls.Api.Persistence;

/// <summary>What a succeeded run records beside its rows.</summary>
internal sealed record RunOutcome(int TotalCount, int DurationMs, string Summary, string EngineVersion);
