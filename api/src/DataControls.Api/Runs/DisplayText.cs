using System.Text.Json;

namespace DataControls.Api.Runs;

/// <summary>
/// The one line a stored violation is searched and sorted by: its display values joined by one space, a
/// number as in JSON, a boolean as <c>true</c> or <c>false</c>, a null left out, cut to the column's length.
/// </summary>
internal static class DisplayText
{
    public const int MaxLength = 400;

    /// <summary>
    /// The values in the order of the entity's identifying fields; when that order is not known, in the
    /// order the engine wrote them.
    /// </summary>
    public static string Of(JsonElement display, IReadOnlyList<string>? identifyingFields)
    {
        var values = identifyingFields is null
            ? display.EnumerateObject().Select(member => member.Value)
            : identifyingFields.Where(field => display.TryGetProperty(field, out _)).Select(field => display.GetProperty(field));
        return Cut(string.Join(' ', values.Select(Render).Where(text => text is not null)));
    }

    private static string? Render(JsonElement value) => value.ValueKind switch
    {
        JsonValueKind.Null or JsonValueKind.Undefined => null,
        JsonValueKind.String => value.GetString(),
        _ => value.GetRawText(),
    };

    private static string Cut(string text)
    {
        if (text.Length <= MaxLength)
        {
            return text;
        }

        // Never end on half of a surrogate pair.
        var length = char.IsHighSurrogate(text[MaxLength - 1]) ? MaxLength - 1 : MaxLength;
        return text[..length];
    }
}
