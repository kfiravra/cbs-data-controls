using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using DataControls.Api.Hosting;
using DataControls.Api.Persistence;

namespace DataControls.Api.Controls;

/// <summary>
/// Decides whether a definition changed. Two definitions are the same when their canonical forms are:
/// object keys sorted ordinally, no whitespace, every string and number as its own token. Key order and
/// layout therefore do not make a new version; a different value, or a list in another order, does.
/// </summary>
internal static class DefinitionHasher
{
    private const string RootEntityMember = "rootEntity";

    /// <summary>What a version row keeps of a schema-valid definition.</summary>
    public static StoredDefinition ToStored(JsonElement definition) =>
        new(StoredJson.Minify(definition), Hash(definition), definition.GetProperty(RootEntityMember).GetString() ?? string.Empty);

    /// <summary>SHA-256 of the canonical form, as 64 lower-case hexadecimal characters.</summary>
    public static string Hash(JsonElement definition) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(Canonical(definition))));

    internal static string Canonical(JsonElement definition) =>
        StoredJson.Write(writer => WriteCanonical(writer, definition));

    private static void WriteCanonical(Utf8JsonWriter writer, JsonElement element)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                writer.WriteStartObject();
                foreach (var member in element.EnumerateObject().OrderBy(member => member.Name, StringComparer.Ordinal))
                {
                    writer.WritePropertyName(member.Name);
                    WriteCanonical(writer, member.Value);
                }

                writer.WriteEndObject();
                break;
            case JsonValueKind.Array:
                writer.WriteStartArray();
                foreach (var item in element.EnumerateArray())
                {
                    WriteCanonical(writer, item);
                }

                writer.WriteEndArray();
                break;
            case JsonValueKind.String:
                // Through the decoded value, so two spellings of one string (an escape or the letter) are equal.
                writer.WriteStringValue(element.GetString());
                break;
            default:
                // A number keeps its own digits (1 is not 1.0); true, false and null have one spelling.
                writer.WriteRawValue(element.GetRawText());
                break;
        }
    }
}
