using System.Text.Json;
using DataControls.Api.Persistence;

namespace DataControls.Api.Runs;

/// <summary>
/// The contract's <c>Run</c>. Counts, sentence and conditions are null unless the run succeeded; the error
/// is null unless it failed or timed out.
/// </summary>
public sealed record RunResponse(
    int Id,
    int ControlId,
    string ControlName,
    int ControlVersion,
    string RootEntity,
    DateOnly RunDate,
    string Language,
    DateTime StartedAt,
    DateTime? FinishedAt,
    RunStatus Status,
    int? TotalCount,
    int? StoredCount,
    bool CapExceeded,
    int? DurationMs,
    JsonElement? Sentence,
    JsonElement? SentenceParts,
    JsonElement? Conditions,
    RunErrorResponse? Error,
    PreviousRunResponse? PreviousRun);
