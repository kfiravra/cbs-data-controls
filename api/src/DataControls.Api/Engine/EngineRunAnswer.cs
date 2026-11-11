using System.Text.Json;

namespace DataControls.Api.Engine;

/// <summary>
/// The engine's answer to <c>/run</c>. The counts, versions and violations are read; the sentence, its
/// parts and the per-condition summaries are kept as received and never interpreted.
/// </summary>
public sealed class EngineRunAnswer
{
    private const int MaxKeyLength = 64;

    private EngineRunAnswer(JsonElement root, IReadOnlyList<EngineViolation> violations)
    {
        TotalCount = root.GetProperty("totalCount").GetInt32();
        DurationMs = root.GetProperty("durationMs").GetInt32();
        EngineVersion = Text(root.GetProperty("engineVersion"));
        GlossaryVersion = Text(root.GetProperty("glossaryVersion"));
        Sentence = Expect(root.GetProperty("sentence"), JsonValueKind.String);
        SentenceParts = Expect(root.GetProperty("sentenceParts"), JsonValueKind.Array);
        Conditions = Expect(root.GetProperty("conditions"), JsonValueKind.Array);
        Violations = violations;
    }

    public int TotalCount { get; }

    public int DurationMs { get; }

    public string EngineVersion { get; }

    public string GlossaryVersion { get; }

    public JsonElement Sentence { get; }

    public JsonElement SentenceParts { get; }

    public JsonElement Conditions { get; }

    public IReadOnlyList<EngineViolation> Violations { get; }

    internal static EngineRunAnswer Parse(byte[] body)
    {
        try
        {
            using var document = JsonDocument.Parse(body);
            var root = document.RootElement.Clone();
            var violations = root.GetProperty("violations").EnumerateArray().Select(ReadViolation).ToList();
            var answer = new EngineRunAnswer(root, violations);
            return answer.TotalCount >= violations.Count && answer.DurationMs >= 0
                ? answer
                : throw EngineException.Unexpected("a run answer whose counts do not add up");
        }
        catch (Exception exception) when (exception is JsonException or KeyNotFoundException or InvalidOperationException or FormatException)
        {
            throw EngineException.Unexpected("a run answer that is not the contract's shape", exception);
        }
    }

    private static EngineViolation ReadViolation(JsonElement violation)
    {
        var key = Text(violation.GetProperty("key"));
        if (key.Length is 0 or > MaxKeyLength)
        {
            throw new InvalidOperationException("A record key must have 1 to 64 characters.");
        }

        return new EngineViolation(
            key,
            Expect(violation.GetProperty("display"), JsonValueKind.Object),
            [.. violation.GetProperty("matched").EnumerateArray().Select(Text)],
            Expect(violation.GetProperty("reasons"), JsonValueKind.Array),
            Text(violation.GetProperty("reasonText")));
    }

    private static string Text(JsonElement element) =>
        element.GetString() ?? throw new InvalidOperationException("A null where the run answer has a string.");

    private static JsonElement Expect(JsonElement element, JsonValueKind kind) =>
        element.ValueKind == kind ? element : throw new InvalidOperationException($"Expected {kind}, found {element.ValueKind}.");
}
