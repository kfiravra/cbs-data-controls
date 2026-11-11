namespace DataControls.Api.Runs;

/// <summary>The query of a run's results as it arrived; <c>sort</c> is <c>key</c> or <c>display</c>, <c>dir</c> <c>asc</c> or <c>desc</c>.</summary>
public sealed record ResultsQuery(string? Search, string? Condition, string? Sort, string? Dir, int? Page, int? PageSize);
