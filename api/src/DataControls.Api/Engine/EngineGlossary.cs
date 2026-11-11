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
        IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> entityLabels,
        IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> fieldTypes)
    {
        Body = body;
        Version = version;
        Languages = languages;
        DefaultLanguage = defaultLanguage;
        IdentifyingFields = identifyingFields;
        EntityLabels = entityLabels;
        FieldTypes = fieldTypes;
    }

    public byte[] Body { get; }

    public string Version { get; }

    public IReadOnlyList<string> Languages { get; }

    public string DefaultLanguage { get; }

    /// <summary>Entity key to its identifying field keys, in the glossary's order.</summary>
    public IReadOnlyDictionary<string, IReadOnlyList<string>> IdentifyingFields { get; }

    /// <summary>Entity key to its plural label, one text per language.</summary>
    public IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> EntityLabels { get; }

    /// <summary>Entity key to the glossary type of each of its fields (<c>text</c>, <c>number</c>, <c>date</c> and so on).</summary>
    public IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> FieldTypes { get; }

    internal static EngineGlossary Parse(byte[] body)
    {
        try
        {
            using var document = JsonDocument.Parse(body);
            var root = document.RootElement;
            var identifyingFields = new Dictionary<string, IReadOnlyList<string>>();
            var entityLabels = new Dictionary<string, IReadOnlyDictionary<string, string>>();
            var fieldTypes = new Dictionary<string, IReadOnlyDictionary<string, string>>();
            foreach (var entity in root.GetProperty("entities").EnumerateArray())
            {
                var key = Text(entity.GetProperty("key"));
                identifyingFields[key] = Texts(entity.GetProperty("identifyingFields"));
                entityLabels[key] = PluralLabels(entity);
                fieldTypes[key] = TypesOfFields(entity);
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
                entityLabels,
                fieldTypes);
        }
        catch (Exception exception) when (exception is JsonException or KeyNotFoundException or InvalidOperationException)
        {
            throw EngineException.Unexpected("a glossary that is not the contract's shape", exception);
        }
    }

    /// <summary>
    /// An entity's plural label per language. Only a sorted list reads it: a glossary without it is still
    /// served and still gives its identifying fields, and that entity is then sorted by its key.
    /// </summary>
    private static Dictionary<string, string> PluralLabels(JsonElement entity) =>
        entity.TryGetProperty("label", out var label)
        && label.ValueKind == JsonValueKind.Object
        && label.TryGetProperty("plural", out var plural)
        && plural.ValueKind == JsonValueKind.Object
            ? plural.EnumerateObject()
                .Where(text => text.Value.ValueKind == JsonValueKind.String)
                .ToDictionary(text => text.Name, text => Text(text.Value))
            : [];

    /// <summary>The type of each field of an entity. Only a sort by a field reads it: a field without one sorts as text.</summary>
    private static Dictionary<string, string> TypesOfFields(JsonElement entity) =>
        entity.TryGetProperty("fields", out var fields) && fields.ValueKind == JsonValueKind.Array
            ? fields.EnumerateArray()
                .Where(field => field.ValueKind == JsonValueKind.Object
                    && field.TryGetProperty("key", out var key) && key.ValueKind == JsonValueKind.String
                    && field.TryGetProperty("type", out var type) && type.ValueKind == JsonValueKind.String)
                .ToDictionary(field => Text(field.GetProperty("key")), field => Text(field.GetProperty("type")))
            : [];

    private static string Text(JsonElement element) =>
        element.GetString() ?? throw new InvalidOperationException("A null where the glossary has a string.");

    private static List<string> Texts(JsonElement array) => [.. array.EnumerateArray().Select(Text)];
}
