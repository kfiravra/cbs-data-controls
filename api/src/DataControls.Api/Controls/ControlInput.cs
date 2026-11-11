using System.Text.Json;
using DataControls.Api.Errors;

namespace DataControls.Api.Controls;

/// <summary>The name, description and definition of a save request, after the request check.</summary>
internal sealed record ControlInput(string Name, string? Description, JsonElement Definition)
{
    public const int MaxNameLength = 200;
    public const int MaxDescriptionLength = 1000;

    /// <summary>
    /// Reads the three members every save carries. <paramref name="pointer"/> is where the object sits in
    /// the body: empty for a single control, <c>/items/2</c> for one of several.
    /// </summary>
    public static ControlInput Read(RequestCheck check, string pointer, string? name, string? description, JsonElement? definition) =>
        new(
            check.Text($"{pointer}/name", name, MaxNameLength),
            check.OptionalText($"{pointer}/description", description, MaxDescriptionLength),
            check.Definition($"{pointer}/definition", definition));
}
