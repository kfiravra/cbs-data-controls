namespace DataControls.Api.Controls;

/// <summary>
/// The query of the controls list as it arrived; <c>active</c> is <c>true</c>, <c>false</c> or <c>all</c>,
/// <c>sort</c> one of <c>name</c>, <c>rootEntity</c>, <c>lastRun</c> and <c>violations</c>, <c>dir</c>
/// <c>asc</c> or <c>desc</c>.
/// </summary>
public sealed record ControlListQuery(string? Search, string? RootEntity, string? Active, string? Sort, string? Dir, int? Page, int? PageSize);
