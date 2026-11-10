using System.Text.Json;

namespace DataControls.Api.Tests.Support;

/// <summary>The example controls and the invalid fixtures of <c>contracts/examples/</c>, as the tests read them.</summary>
internal static class Examples
{
    public const string First = "minor-high-salary";

    private static readonly string _directory = Path.Combine(ContractFiles.Root, "examples");

    /// <summary>The six example ids, for a theory.</summary>
    public static TheoryData<string> Ids => [.. Names(_directory)];

    /// <summary>The invalid fixtures of one layer (<c>schema</c> or <c>semantic</c>), for a theory.</summary>
    public static TheoryData<string> InvalidOf(string layer) =>
        [.. Names(Path.Combine(_directory, "invalid")).Where(name => Invalid(name).GetProperty("layer").GetString() == layer)];

    public static JsonElement Example(string id) => Parse(Path.Combine(_directory, $"{id}.json"));

    public static JsonElement Invalid(string name) => Parse(Path.Combine(_directory, "invalid", $"{name}.json"));

    /// <summary>A definition as compact JSON text, ready to sit inside a request body.</summary>
    public static string Definition(string id) => Example(id).GetProperty("definition").GetRawText();

    private static IEnumerable<string> Names(string directory) =>
        Directory.GetFiles(directory, "*.json").Select(file => Path.GetFileNameWithoutExtension(file)!).Order(StringComparer.Ordinal);

    private static JsonElement Parse(string file)
    {
        using var document = JsonDocument.Parse(File.ReadAllText(file));
        return document.RootElement.Clone();
    }
}
