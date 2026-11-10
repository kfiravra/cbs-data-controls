using System.Text.Json.Serialization;

namespace DataControls.Api.Errors;

/// <summary>
/// One fault of a definition found by the api's own layer. <paramref name="Path"/> is a JSON Pointer into
/// the definition; <paramref name="NodeId"/> is the id of the nearest node at or above it, when one has an id.
/// </summary>
public sealed record DefinitionError(
    string Code,
    string Path,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? NodeId)
{
    private static readonly IReadOnlyDictionary<string, string> _noParams = new Dictionary<string, string>();

    /// <summary>The two codes of this layer take no params.</summary>
    public IReadOnlyDictionary<string, string> Params => _noParams;
}
