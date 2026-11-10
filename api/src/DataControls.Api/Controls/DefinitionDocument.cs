using System.Text.Json;

namespace DataControls.Api.Controls;

/// <summary>Reads a definition by JSON Pointer: where a path sits in the text, and which node encloses it.</summary>
internal static class DefinitionDocument
{
    private const string NodeIdMember = "id";
    private const string WhereMember = "where";
    private const string ChildrenMember = "children";

    /// <summary>
    /// Every pointer of the document mapped to its position in the JSON text, an object before the members
    /// inside it: the order the contract lists errors in.
    /// </summary>
    public static IReadOnlyDictionary<string, int> PositionsOf(JsonElement definition)
    {
        var positions = new Dictionary<string, int>();
        Visit(definition, string.Empty, positions);
        return positions;
    }

    /// <summary>
    /// The <c>id</c> of the nearest node at or above the path that has a string one, or null. A node is the
    /// root group (<c>/where</c>), a child of a group, or the <c>where</c> of a related node; the definition
    /// itself and a field reference are not nodes, whatever members they carry.
    /// </summary>
    public static string? NearestNodeId(JsonElement definition, string pointer)
    {
        var current = definition;
        var position = Position.Definition;
        string? nearest = null;
        foreach (var segment in pointer.Split('/', StringSplitOptions.RemoveEmptyEntries))
        {
            var name = Unescape(segment);
            if (!TryStep(current, name, out current))
            {
                break;
            }

            position = Next(position, name);
            if (position == Position.Node)
            {
                nearest = IdOf(current) ?? nearest;
            }
        }

        return nearest;
    }

    private static Position Next(Position position, string segment) => (position, segment) switch
    {
        (Position.Definition or Position.Node, WhereMember) => Position.Node,
        (Position.Node, ChildrenMember) => Position.Children,
        (Position.Children, _) => Position.Node,
        _ => Position.Elsewhere,
    };

    private static void Visit(JsonElement element, string pointer, Dictionary<string, int> positions)
    {
        positions[pointer] = positions.Count;
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                foreach (var member in element.EnumerateObject())
                {
                    Visit(member.Value, $"{pointer}/{Escape(member.Name)}", positions);
                }

                break;
            case JsonValueKind.Array:
                var index = 0;
                foreach (var item in element.EnumerateArray())
                {
                    Visit(item, $"{pointer}/{index++}", positions);
                }

                break;
        }
    }

    private static bool TryStep(JsonElement element, string segment, out JsonElement child)
    {
        child = default;
        return element.ValueKind switch
        {
            JsonValueKind.Object => element.TryGetProperty(segment, out child),
            JsonValueKind.Array when int.TryParse(segment, out var index) && index >= 0 && index < element.GetArrayLength() =>
                Item(element, index, out child),
            _ => false,
        };
    }

    private static bool Item(JsonElement array, int index, out JsonElement item)
    {
        item = array[index];
        return true;
    }

    private static string? IdOf(JsonElement element) =>
        element.ValueKind == JsonValueKind.Object
        && element.TryGetProperty(NodeIdMember, out var id)
        && id.ValueKind == JsonValueKind.String
            ? id.GetString()
            : null;

    private static string Escape(string name) => name.Replace("~", "~0").Replace("/", "~1");

    private static string Unescape(string segment) => segment.Replace("~1", "/").Replace("~0", "~");

    /// <summary>Where a step of the pointer stands in the tree of nodes.</summary>
    private enum Position
    {
        Definition,
        Node,
        Children,
        Elsewhere,
    }
}
