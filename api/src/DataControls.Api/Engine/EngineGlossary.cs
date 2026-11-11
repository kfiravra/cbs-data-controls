using System.Text.Json;

namespace DataControls.Api.Engine;

/// <summary>
/// The engine's public glossary: the body as received, which the api serves unchanged, and the few
/// members the api itself reads.
/// </summary>
public sealed class EngineGlossary
{
    private EngineGlossary(
        byte[] body,
        string version,
        IReadOnlyList<string> languages,
        string defaultLanguage,
        IReadOnlyDictionary<string, IReadOnlyList<string>> identifyingFields,
        IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> entityLabels)
    {
        Body = body;
        Version = version;
        Languages = languages;
        DefaultLanguage = defaultLanguage;
        IdentifyingFields = identifyingFields;
        EntityLabels = entityLabels;
    }

    public byte[] Body { get; }

    public string Version { get; }

    public IReadOnlyList<string> Languages { get; }

    public string DefaultLanguage { get; }

    /// <summary>Entity key to its identifying field keys, in the glossary's order.</summary>
    public IReadOnlyDictionary<string, IReadOnlyList<string>> IdentifyingFields { get; }

    /// <summary>Entity key to its plural label, one text per language.</summary>
    public IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> EntityLabels { get; }

    internal static EngineGlossary Parse(byte[] body)
    {
        try
        {
            using var document = JsonDocument.Parse(body);
            var root = document.RootElement;
            var identifyingFields = new Dictionary<string, IReadOnlyList<string>>();
            var entityLabels = new Dictionary<string, IReadOnlyDictionary<string, string>>();
            foreach (var entity in root.GetProperty("entities").EnumerateArray())
            {
                var key = Text(entity.GetProperty("key"));
                identifyingFields[key] = Texts(entity.GetProperty("identifyingFields"));
                entityLabels[key] = entity.GetProperty("label").GetProperty("plural").EnumerateObject()
                    .ToDictionary(text => text.Name, text => Text(text.Value));
            }

            var languages = Texts(root.GetProperty("languages"));
            if (languages.Count == 0)
            {
                throw EngineException.Unexpected("a glossary without languages");
            }

            return new EngineGlossary(
                body,
                Text(root.GetProperty("glossaryVersion")),
                languages,
                Text(root.GetProperty("defaultLanguage")),
                identifyingFields,
                entityLabels);
        }
        catch (Exception exception) when (exception is JsonException or KeyNotFoundException or InvalidOperationException)
        {
            throw EngineException.Unexpected("a glossary that is not the contract's shape", exception);
        }
    }

    private static string Text(JsonElement element) =>
        element.GetString() ?? throw new InvalidOperationException("A null where the glossary has a string.");

    private static List<string> Texts(JsonElement array) => [.. array.EnumerateArray().Select(Text)];
}
