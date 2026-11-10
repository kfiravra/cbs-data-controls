namespace DataControls.Api.Controls;

/// <summary>The contract's <c>ControlSummary</c>: a row of the controls list.</summary>
public sealed record ControlSummaryResponse(
    int Id,
    string Name,
    string? Description,
    string RootEntity,
    int Version,
    bool IsActive,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    LastRunResponse? LastRun);
