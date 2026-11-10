using DataControls.Api.Engine;
using DataControls.Api.Hosting;
using DataControls.Api.Persistence;

namespace DataControls.Api.Runs;

/// <summary>Turns the engine's run answer into what a run stores: its rows and its summary.</summary>
internal static class RunSnapshot
{
    /// <summary>
    /// One row per violation, numbered from 1 in the engine's order, at most <paramref name="rowCap"/> of
    /// them. The display object and the reasons are kept as the JSON text received.
    /// </summary>
    public static IEnumerable<RunResult> Rows(EngineRunAnswer answer, IReadOnlyList<string>? identifyingFields, int rowCap) =>
        answer.Violations
            .Take(rowCap)
            .Select((violation, index) => new RunResult(
                index + 1,
                violation.Key,
                violation.Display.GetRawText(),
                DisplayText.Of(violation.Display, identifyingFields),
                [.. violation.Matched],
                violation.Reasons.GetRawText(),
                violation.ReasonText));

    /// <summary>The engine's sentence, its parts and the per-condition summaries, copied without being read.</summary>
    public static string Summary(EngineRunAnswer answer) =>
        StoredJson.Write(writer =>
        {
            writer.WriteStartObject();
            writer.WritePropertyName(RunSummary.Sentence);
            answer.Sentence.WriteTo(writer);
            writer.WritePropertyName(RunSummary.SentenceParts);
            answer.SentenceParts.WriteTo(writer);
            writer.WritePropertyName(RunSummary.Conditions);
            answer.Conditions.WriteTo(writer);
            writer.WriteEndObject();
        });
}
