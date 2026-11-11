namespace DataControls.Api.Runs;

/// <summary>The control's newest succeeded run that started before this one.</summary>
public sealed record PreviousRunResponse(int Id, DateTime StartedAt, int TotalCount);
