using System.Text.Json;
using System.Text.Json.Nodes;

namespace DataControls.Api.Tests.Support;

/// <summary>
/// Builds what the engine would answer to <c>/run</c>, in the contract's shape, from a list of violations:
/// for an example, the keys and matched ids of its <c>expected</c>. Texts are made up and predictable.
/// Display values follow the root entity's identifying fields as the glossary fixture lists them, each a
/// number or a string by the field's type there; nothing here names a field.
/// </summary>
internal static class RunAnswers
{
    public const string EngineVersion = "0.1.0";
    public const string GlossaryVersion = "1.0.0";
    public const int DurationMs = 41;

    private const string NumberType = "number";

    /// <summary>The root entity of the first example, for a test that needs any rootable entity.</summary>
    public static string AnyRootEntity => Examples.RootEntity(Examples.First);

    /// <summary>The answer for an example control: every violation of its <c>expected</c>, in its order.</summary>
    public static string ForExample(string exampleId)
    {
        var expected = Examples.Example(exampleId).GetProperty("expected");
        var violations = expected.GetProperty("violations").EnumerateArray()
            .Select(violation => new Violation(
                violation.GetProperty("key").GetString()!,
                [.. violation.GetProperty("matched").EnumerateArray().Select(id => id.GetString()!)]))
            .ToList();
        return Build(Examples.RootEntity(exampleId), violations, expected.GetProperty("total").GetInt32());
    }

    /// <summary><paramref name="count"/> violations keyed 1001 and up, each matching c1.</summary>
    public static string Numbered(int count, int? total = null) =>
        Build(AnyRootEntity, [.. Enumerable.Range(1001, count).Select(key => new Violation(key.ToString(), ["c1"]))], total ?? count);

    public static string Build(string rootEntity, IReadOnlyList<Violation> violations, int total, string glossaryVersion = GlossaryVersion)
    {
        var conditionIds = violations.SelectMany(violation => violation.Matched).Distinct().ToList();
        var answer = new JsonObject
        {
            ["runDate"] = "2026-11-01",
            ["totalCount"] = total,
            ["returnedCount"] = violations.Count,
            ["capExceeded"] = total > violations.Count,
            ["durationMs"] = DurationMs,
            ["engineVersion"] = EngineVersion,
            ["glossaryVersion"] = glossaryVersion,
            ["sentence"] = string.Join(" and ", conditionIds.Select(SentenceOf)),
            ["sentenceParts"] = new JsonArray([.. conditionIds.Select(id => Part(SentenceOf(id), id))]),
            ["conditions"] = new JsonArray([.. conditionIds.Select(id => (JsonNode)new JsonObject
            {
                ["id"] = id,
                ["sentence"] = SentenceOf(id),
                ["sentenceParts"] = new JsonArray(Part(SentenceOf(id), id)),
                ["count"] = violations.Count(violation => violation.Matched.Contains(id)),
            })]),
            ["violations"] = new JsonArray([.. violations.Select(violation => (JsonNode)ViolationNode(rootEntity, violation))]),
        };
        return answer.ToJsonString();
    }

    public static string SentenceOf(string conditionId) => $"sentence of {conditionId}";

    public static string ReasonOf(string conditionId, string key) => $"{conditionId} holds for {key}";

    /// <summary>
    /// A violation whose display values are one token in every text field and one number in every number
    /// field: two such violations with the same tokens have the same display text.
    /// </summary>
    public static Violation Uniform(string rootEntity, string key, string text, int number = 7) =>
        new(key, ["c1"], [.. IdentifyingFields(rootEntity).Select(field => field.IsNumber ? number.ToString() : text)]);

    /// <summary>The display values of a violation as text, one per identifying field, in the glossary's order.</summary>
    public static IReadOnlyList<string> DisplayTokens(string rootEntity, Violation violation) =>
        [.. IdentifyingFields(rootEntity).Select((field, position) => Token(field, position, violation) ?? string.Empty)];

    /// <summary>The display value as text; null when the violation was given a display whose value here is missing.</summary>
    private static string? Token(Field field, int position, Violation violation) =>
        violation.Display is { } display
            ? display[position]
            : field.IsNumber ? $"{position + 1}00" : $"value{position}of{violation.Key}";

    /// <summary>The root entity's identifying fields in the glossary's order, each with whether it is a number.</summary>
    private static List<Field> IdentifyingFields(string rootEntity)
    {
        using var glossary = JsonDocument.Parse(EngineFixtures.Read("glossary.json"));
        var entity = glossary.RootElement.GetProperty("entities").EnumerateArray()
            .Single(candidate => candidate.GetProperty("key").GetString() == rootEntity);
        var types = entity.GetProperty("fields").EnumerateArray()
            .ToDictionary(field => field.GetProperty("key").GetString()!, field => field.GetProperty("type").GetString());
        return [.. entity.GetProperty("identifyingFields").EnumerateArray()
            .Select(field => field.GetString()!)
            .Select(key => new Field(key, types[key] == NumberType))];
    }

    private static JsonObject ViolationNode(string rootEntity, Violation violation)
    {
        var fields = IdentifyingFields(rootEntity);
        // Written last field first, so the order of display_text can only come from the glossary.
        var display = new JsonObject();
        for (var position = fields.Count - 1; position >= 0; position--)
        {
            var token = Token(fields[position], position, violation);
            display[fields[position].Key] = token is null ? null : fields[position].IsNumber ? long.Parse(token) : token;
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
                ["params"] = new JsonObject { ["left"] = new JsonObject { ["field"] = fields[0].Key }, ["actual"] = violation.Key, ["value"] = violation.Key },
                ["text"] = violation.ReasonText ?? ReasonOf(id, violation.Key),
                ["textParts"] = new JsonArray(Part(violation.ReasonText ?? ReasonOf(id, violation.Key), id)),
            })]),
            ["reasonText"] = string.Join("; ", violation.Matched.Select(id => violation.ReasonText ?? ReasonOf(id, violation.Key))),
        };
    }

    private static JsonNode Part(string text, string nodeId) =>
        new JsonObject { ["text"] = text, ["nodeId"] = nodeId, ["role"] = "field" };

    /// <summary>
    /// One violation to put in an answer. <paramref name="Display"/> gives a value per identifying field, by
    /// position (a number field takes digits); left out, the values are made up from the key.
    /// </summary>
    public sealed record Violation(
        string Key,
        IReadOnlyList<string> Matched,
        IReadOnlyList<string?>? Display = null,
        string? ReasonText = null);

    /// <summary>
    /// A violation whose display differs from its neighbours' in one identifying field only (by position; null
    /// for a missing value): every other field holds the same token, so only that field can order them.
    /// </summary>
    public static Violation Differing(string rootEntity, string key, int position, string? value) =>
        new(key, ["c1"], [.. IdentifyingFields(rootEntity).Select((field, index) => index == position ? value : field.IsNumber ? "7" : "same")]);

    /// <summary>The position and the key of the root entity's first identifying field that is, or is not, a number.</summary>
    public static (int Position, string Key) IdentifyingField(string rootEntity, bool number)
    {
        var fields = IdentifyingFields(rootEntity);
        var position = fields.FindIndex(field => field.IsNumber == number);
        return (position, fields[position].Key);
    }

    /// <summary>A field of the root entity that is not one of its identifying fields.</summary>
    public static string OtherField(string rootEntity)
    {
        using var glossary = JsonDocument.Parse(EngineFixtures.Read("glossary.json"));
        var entity = glossary.RootElement.GetProperty("entities").EnumerateArray()
            .Single(candidate => candidate.GetProperty("key").GetString() == rootEntity);
        var identifying = IdentifyingFields(rootEntity).Select(field => field.Key).ToHashSet();
        return entity.GetProperty("fields").EnumerateArray()
            .Select(field => field.GetProperty("key").GetString()!)
            .First(key => !identifying.Contains(key));
    }

    private sealed record Field(string Key, bool IsNumber);
}
