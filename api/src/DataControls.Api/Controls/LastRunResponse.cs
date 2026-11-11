using DataControls.Api.Persistence;

namespace DataControls.Api.Controls;

/// <summary>The control's newest run of any status.</summary>
public sealed record LastRunResponse(int Id, DateTime StartedAt, RunStatus Status, int? TotalCount);
