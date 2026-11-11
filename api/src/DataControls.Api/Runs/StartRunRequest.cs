namespace DataControls.Api.Runs;

/// <summary><c>runDate</c> is a <c>YYYY-MM-DD</c> string; absent or null means today.</summary>
public sealed record StartRunRequest(string? RunDate);
