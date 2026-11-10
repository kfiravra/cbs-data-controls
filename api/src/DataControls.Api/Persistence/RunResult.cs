namespace DataControls.Api.Persistence;

/// <summary>One stored violation of a run. <see cref="Seq"/> is its position in the engine's order.</summary>
internal sealed class RunResult
{
    private RunResult()
    {
    }

    public RunResult(int seq, string recordKey, string recordDisplay, string displayText, List<string> matchedConditionIds, string reasons, string reasonText)
    {
        Seq = seq;
        RecordKey = recordKey;
        RecordDisplay = recordDisplay;
        DisplayText = displayText;
        MatchedConditionIds = matchedConditionIds;
        Reasons = reasons;
        ReasonText = reasonText;
    }

    public long Id { get; private set; }

    public int RunId { get; private set; }

    public int Seq { get; private set; }

    public string RecordKey { get; private set; } = string.Empty;

    /// <summary>The engine's <c>display</c> object, as JSON text.</summary>
    public string RecordDisplay { get; private set; } = string.Empty;

    /// <summary>The display values in one line, for search and sort.</summary>
    public string DisplayText { get; private set; } = string.Empty;

    /// <summary>Typed, so the condition filter stays LINQ (an <c>OPENJSON</c> predicate).</summary>
    public List<string> MatchedConditionIds { get; private set; } = [];

    /// <summary>The engine's <c>reasons</c> array, as JSON text.</summary>
    public string Reasons { get; private set; } = string.Empty;

    public string ReasonText { get; private set; } = string.Empty;
}
