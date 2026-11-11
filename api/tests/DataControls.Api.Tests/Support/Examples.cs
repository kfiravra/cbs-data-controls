using System.Text.Json;
using System.Text.Json.Nodes;

namespace DataControls.Api.Tests.Support;

/// <summary>The example controls and the invalid fixtures of <c>contracts/examples/</c>, as the tests read them.</summary>
internal static class Examples
{
    public const string First = "minor-high-salary";

    private static readonly string _directory = Path.Combine(ContractFiles.Root, "examples");

    /// <summary>The six example ids, for a theory.</summary>
    public static TheoryData<string> Ids => [.. AllIds];

    /// <summary>The six example ids.</summary>
    public static IReadOnlyList<string> AllIds => [.. Names(_directory)];

    /// <summary>The invalid fixtures of one layer (<c>schema</c> or <c>semantic</c>), for a theory.</summary>
    public static TheoryData<string> InvalidOf(string layer) => [.. InvalidNamesOf(layer)];

    /// <summary>The names of the invalid fixtures of one layer.</summary>
    public static IReadOnlyList<string> InvalidNamesOf(string layer) =>
        [.. Names(Path.Combine(_directory, "invalid")).Where(name => Invalid(name).GetProperty("layer").GetString() == layer)];

    public static JsonElement Example(string id) => Parse(Path.Combine(_directory, $"{id}.json"));

    public static JsonElement Invalid(string name) => Parse(Path.Combine(_directory, "invalid", $"{name}.json"));

    /// <summary>A definition as compact JSON text, ready to sit inside a request body.</summary>
    public static string Definition(string id) => Example(id).GetProperty("definition").GetRawText();

    /// <summary>The root entity key of an example's definition.</summary>
    public static string RootEntity(string id) =>
        Example(id).GetProperty("definition").GetProperty("rootEntity").GetString()!;

    /// <summary>
    /// The same definition with every object's members in the opposite order and with indentation: another
    /// text of the same rule.
    /// </summary>
    public static string Reordered(string definitionJson) =>
        Reverse(JsonNode.Parse(definitionJson)!).ToJsonString(new JsonSerializerOptions { WriteIndented = true });

    private static JsonNode Reverse(JsonNode node) => node switch
    {
        JsonObject members => new JsonObject(members.Reverse().Select(member => KeyValuePair.Create(member.Key, member.Value is null ? null : (JsonNode?)Reverse(member.Value)))),
        JsonArray items => new JsonArray([.. items.Select(item => item is null ? null : Reverse(item))]),
        _ => node.DeepClone(),
    };

    private static IEnumerable<string> Names(string directory) =>
        Directory.GetFiles(directory, "*.json").Select(file => Path.GetFileNameWithoutExtension(file)!).Order(StringComparer.Ordinal);

    private static JsonElement Parse(string file)
    {
        using var document = JsonDocument.Parse(File.ReadAllText(file));
        return document.RootElement.Clone();
    }
}
