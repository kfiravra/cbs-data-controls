using System.Text.Json;
using System.Text.Json.Nodes;

namespace DataControls.Api.Tests.Support;

/// <summary>
/// Builds what the engine would answer to <c>/run</c>, in the contract's shape, from a list of violations:
/// for an example, the keys and matched ids of its <c>expected</c>. Texts and display values are made up
/// and predictable, so a test can say what must come back without reading the code under test.
/// </summary>
internal static class RunAnswers
{
    public const string EngineVersion = "0.1.0";
    public const string GlossaryVersion = "1.0.0";
    public const int DurationMs = 41;

    /// <summary>The answer for an example control: every violation of its <c>expected</c>, in its order.</summary>
    public static string ForExample(string exampleId)
    {
        var example = Examples.Example(exampleId);
        var expected = example.GetProperty("expected");
        var rootEntity = example.GetProperty("definition").GetProperty("rootEntity").GetString()!;
        var violations = expected.GetProperty("violations").EnumerateArray()
            .Select(violation => new Violation(
                violation.GetProperty("key").GetString()!,
                [.. violation.GetProperty("matched").EnumerateArray().Select(id => id.GetString()!)]))
            .ToList();
        return Build(rootEntity, violations, expected.GetProperty("total").GetInt32());
    }

    /// <summary><paramref name="count"/> violations of an employee control, keyed 1001 and up, each matching c1.</summary>
    public static string Numbered(int count, int? total = null) =>
        Build("employee", [.. Enumerable.Range(1001, count).Select(key => new Violation(key.ToString(), ["c1"]))], total ?? count);

    public static string Build(string rootEntity, IReadOnlyList<Violation> violations, int total)
    {
        var fields = IdentifyingFields(rootEntity);
        var conditionIds = violations.SelectMany(violation => violation.Matched).Distinct().ToList();
        var answer = new JsonObject
        {
            ["runDate"] = "2026-11-01",
            ["totalCount"] = total,
            ["returnedCount"] = violations.Count,
            ["capExceeded"] = total > violations.Count,
            ["durationMs"] = DurationMs,
            ["engineVersion"] = EngineVersion,
            ["glossaryVersion"] = GlossaryVersion,
            ["sentence"] = Sentence(conditionIds),
            ["sentenceParts"] = new JsonArray([.. conditionIds.Select(id => Part(SentenceOf(id), id))]),
            ["conditions"] = new JsonArray([.. conditionIds.Select(id => (JsonNode)new JsonObject
            {
                ["id"] = id,
                ["sentence"] = SentenceOf(id),
                ["sentenceParts"] = new JsonArray(Part(SentenceOf(id), id)),
                ["count"] = violations.Count(violation => violation.Matched.Contains(id)),
            })]),
            ["violations"] = new JsonArray([.. violations.Select(violation => (JsonNode)ViolationNode(violation, fields))]),
        };
        return answer.ToJsonString();
    }

    public static string Sentence(IEnumerable<string> conditionIds) => string.Join(" and ", conditionIds.Select(SentenceOf));

    public static string SentenceOf(string conditionId) => $"sentence of {conditionId}";

    public static string ReasonOf(string conditionId, string key) => $"{conditionId} holds for {key}";

    /// <summary>What the api must store as <c>display_text</c>: the display values in the glossary's order.</summary>
    public static string DisplayTextOf(string rootEntity, Violation violation) =>
        string.Join(' ', IdentifyingFields(rootEntity).Select(field => DisplayValue(field, violation)));

    public static IReadOnlyList<string> IdentifyingFields(string rootEntity)
    {
        using var glossary = JsonDocument.Parse(EngineFixtures.Read("glossary.json"));
        return [.. glossary.RootElement.GetProperty("entities").EnumerateArray()
            .Single(entity => entity.GetProperty("key").GetString() == rootEntity)
            .GetProperty("identifyingFields").EnumerateArray().Select(field => field.GetString()!)];
    }

    private static string DisplayValue(string field, Violation violation) =>
        violation.DisplayValues?.GetValueOrDefault(field) ?? (field.EndsWith("_number", StringComparison.Ordinal) ? violation.Key : $"{field} of {violation.Key}");

    private static JsonObject ViolationNode(Violation violation, IReadOnlyList<string> fields)
    {
        // Written in reverse, so the order of display_text can only come from the glossary.
        var display = new JsonObject();
        foreach (var field in fields.Reverse())
        {
            var value = DisplayValue(field, violation);
            display[field] = field.EndsWith("_number", StringComparison.Ordinal) && long.TryParse(value, out var number) ? number : value;
        }

        return new JsonObject
        {
            ["key"] = violation.Key,
            ["display"] = display,
            ["matched"] = new JsonArray([.. violation.Matched.Select(id => (JsonNode)id)]),
            ["reasons"] = new JsonArray([.. violation.Matched.Select(id => (JsonNode)new JsonObject
            {
                ["conditionId"] = id,
                ["reasonKey"] = "eq",
                ["params"] = new JsonObject { ["left"] = new JsonObject { ["field"] = "status" }, ["actual"] = violation.Key, ["value"] = "active" },
                ["text"] = violation.ReasonText ?? ReasonOf(id, violation.Key),
                ["textParts"] = new JsonArray(Part(violation.ReasonText ?? ReasonOf(id, violation.Key), id)),
            })]),
            ["reasonText"] = string.Join("; ", violation.Matched.Select(id => violation.ReasonText ?? ReasonOf(id, violation.Key))),
        };
    }

    private static JsonNode Part(string text, string nodeId) =>
        new JsonObject { ["text"] = text, ["nodeId"] = nodeId, ["role"] = "field" };

    /// <summary>One violation to put in an answer; display values and the reason text may be given, else they are made up.</summary>
    public sealed record Violation(
        string Key,
        IReadOnlyList<string> Matched,
        IReadOnlyDictionary<string, string>? DisplayValues = null,
        string? ReasonText = null);
}
