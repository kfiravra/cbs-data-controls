namespace DataControls.Api.Runs;

/// <summary>
/// The query of a run's results as it arrived; <c>sort</c> is <c>key</c>, <c>display</c>, <c>field</c> or
/// <c>reasons</c>, <c>field</c> the identifying field that <c>sort=field</c> sorts by, <c>dir</c> <c>asc</c> or
/// <c>desc</c>.
/// </summary>
public sealed record ResultsQuery(string? Search, string? Condition, string? Sort, string? Field, string? Dir, int? Page, int? PageSize);
