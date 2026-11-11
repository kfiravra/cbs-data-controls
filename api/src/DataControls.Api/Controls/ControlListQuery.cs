namespace DataControls.Api.Controls;

/// <summary>The query of the controls list as it arrived; <c>active</c> is <c>true</c>, <c>false</c> or <c>all</c>.</summary>
public sealed record ControlListQuery(string? Search, string? RootEntity, string? Active, int? Page, int? PageSize);
