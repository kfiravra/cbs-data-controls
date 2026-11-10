namespace DataControls.Api.Persistence;

/// <summary>One run of one version of a control, with what it found.</summary>
internal sealed class Run
{
    private readonly List<RunResult> _results = [];

    private Run()
    {
    }

    public int Id { get; private set; }

    public int ControlId { get; private set; }

    public int VersionNumber { get; private set; }

    public DateOnly RunDate { get; private set; }

    public string Language { get; private set; } = string.Empty;

    public DateTime StartedAt { get; private set; }

    public DateTime? FinishedAt { get; private set; }

    public RunStatus Status { get; private set; }

    public int? TotalCount { get; private set; }

    public int? StoredCount { get; private set; }

    public int? DurationMs { get; private set; }

    /// <summary>The engine's sentence, its parts and the per-condition counts, as JSON text.</summary>
    public string? Summary { get; private set; }

    public string? ErrorCode { get; private set; }

    public string? ErrorParams { get; private set; }

    public string? EngineVersion { get; private set; }

    public string CorrelationId { get; private set; } = string.Empty;

    public IReadOnlyCollection<RunResult> Results => _results;

    public static Run Start(int controlId, int version, DateOnly runDate, string language, string correlationId, DateTime now) =>
        new()
        {
            ControlId = controlId,
            VersionNumber = version,
            RunDate = runDate,
            Language = language,
            StartedAt = now,
            Status = RunStatus.Running,
            CorrelationId = correlationId,
        };

    /// <summary>Closes the run with its snapshot; the stored count is the number of rows given.</summary>
    public void Succeed(RunOutcome outcome, IEnumerable<RunResult> results, DateTime now)
    {
        _results.AddRange(results);
        Status = RunStatus.Succeeded;
        TotalCount = outcome.TotalCount;
        StoredCount = _results.Count;
        DurationMs = outcome.DurationMs;
        Summary = outcome.Summary;
        EngineVersion = outcome.EngineVersion;
        FinishedAt = now;
    }
}
