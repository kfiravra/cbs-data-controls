using System.Globalization;
using System.Text.Json;

namespace DataControls.Api.Controls;

/// <summary>Reads a definition by JSON Pointer: where a path sits in the text, and which node encloses it.</summary>
internal static class DefinitionDocument
{
    private const string NodeIdMember = "id";
    private const string WhereMember = "where";
    private const string ChildrenMember = "children";

    /// <summary>
    /// The pointers in the order of the JSON text, an object before the members inside it (the order the
    /// contract lists errors in), each with the <c>id</c> of the nearest node at or above it that has a
    /// string one, or null. A node is the root group (<c>/where</c>), a child of a group, or the
    /// <c>where</c> of a related node; the definition itself and a field reference are not nodes, whatever
    /// members they carry. A pointer that leads nowhere in the definition comes last, with the id of the
    /// nearest node above the place where it leaves the definition.
    /// </summary>
    /// <remarks>
    /// Only the given pointers are followed, so the work is the size of the definition plus the pointers,
    /// whatever the names and the widths in it. Building a pointer for every element is not an option: a
    /// long member name over a wide array costs their product in memory.
    /// </remarks>
    public static IReadOnlyList<(string Pointer, string? NodeId)> Locate(JsonElement definition, IEnumerable<string> pointers)
    {
        var root = new Branch();
        var asked = new List<string>();
        foreach (var pointer in pointers)
        {
            if (root.Add(pointer))
            {
                asked.Add(pointer);
            }
        }

        var located = new List<(string Pointer, string? NodeId)>(asked.Count);
        var unreached = new Dictionary<string, string?>(StringComparer.Ordinal);
        Follow(definition, root, Position.Definition, nearest: null, located, unreached);
        if (unreached.Count > 0)
        {
            located.AddRange(asked.Where(unreached.ContainsKey).Select(pointer => (pointer, unreached[pointer])));
        }

        return located;
    }

    /// <summary>The nearest node id of one pointer; see <see cref="Locate"/>.</summary>
    public static string? NearestNodeId(JsonElement definition, string pointer) => Locate(definition, [pointer])[0].NodeId;

    private static void Follow(
        JsonElement element,
        Branch branch,
        Position position,
        string? nearest,
        List<(string Pointer, string? NodeId)> located,
        Dictionary<string, string?> unreached)
    {
        if (position == Position.Node)
        {
            nearest = IdOf(element) ?? nearest;
        }

        if (branch.Pointer is not null)
        {
            located.Add((branch.Pointer, nearest));
        }

        if (branch.Steps is not { } steps)
        {
            return;
        }

        var followed = 0;
        Func<string, bool> leadsOn = _ => false;
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                // A name written twice counts where it is written last, which is the member every reader keeps.
                var members = new Dictionary<string, (int Order, JsonElement Value)>(StringComparer.Ordinal);
                var order = 0;
                foreach (var member in element.EnumerateObject())
                {
                    if (steps.ContainsKey(member.Name))
                    {
                        members[member.Name] = (order, member.Value);
                    }

                    order++;
                }

                foreach (var (name, member) in members.OrderBy(member => member.Value.Order))
                {
                    Follow(member.Value, steps[name], Next(position, name), nearest, located, unreached);
                }

                followed = members.Count;
                leadsOn = members.ContainsKey;
                break;
            case JsonValueKind.Array:
                var index = 0;
                foreach (var item in element.EnumerateArray())
                {
                    var step = index.ToString(CultureInfo.InvariantCulture);
                    if (steps.TryGetValue(step, out var next))
                    {
                        Follow(item, next, Next(position, step), nearest, located, unreached);
                        followed++;
                    }

                    index++;
                }

                var length = index;
                leadsOn = step => IsIndexBelow(step, length);
                break;
        }

        if (followed < steps.Count)
        {
            foreach (var (step, next) in steps)
            {
                if (!leadsOn(step))
                {
                    next.AddAllTo(unreached, nearest);
                }
            }
        }
    }

    /// <summary>Whether the step is an index of the array, written the one way an index is followed.</summary>
    private static bool IsIndexBelow(string step, int length) =>
        int.TryParse(step, NumberStyles.None, CultureInfo.InvariantCulture, out var index)
        && index < length
        && index.ToString(CultureInfo.InvariantCulture) == step;

    private static Position Next(Position position, string segment) => (position, segment) switch
    {
        (Position.Definition or Position.Node, WhereMember) => Position.Node,
        (Position.Node, ChildrenMember) => Position.Children,
        (Position.Children, _) => Position.Node,
        _ => Position.Elsewhere,
    };

    private static string? IdOf(JsonElement element) =>
        element.ValueKind == JsonValueKind.Object
        && element.TryGetProperty(NodeIdMember, out var id)
        && id.ValueKind == JsonValueKind.String
            ? id.GetString()
            : null;

    private static string Unescape(string segment) => segment.Replace("~1", "/").Replace("~0", "~");

    /// <summary>Where a step of the pointer stands in the tree of nodes.</summary>
    private enum Position
    {
        Definition,
        Node,
        Children,
        Elsewhere,
    }

    /// <summary>The pointers as a tree of their steps: one branch per distinct prefix.</summary>
    private sealed class Branch
    {
        /// <summary>The pointer that ends here, when one does.</summary>
        public string? Pointer { get; private set; }

        public Dictionary<string, Branch>? Steps { get; private set; }

        /// <summary>Adds the pointer under this branch; false when it was already there.</summary>
        public bool Add(string pointer)
        {
            var branch = this;
            foreach (var segment in pointer.Split('/').Skip(1))
            {
                branch.Steps ??= new Dictionary<string, Branch>(StringComparer.Ordinal);
                var step = Unescape(segment);
                if (!branch.Steps.TryGetValue(step, out var next))
                {
                    next = new Branch();
                    branch.Steps[step] = next;
                }

                branch = next;
            }

            if (branch.Pointer is not null)
            {
                return false;
            }

            branch.Pointer = pointer;
            return true;
        }

        /// <summary>Every pointer that ends at this branch or below it, each with the given id.</summary>
        public void AddAllTo(Dictionary<string, string?> pointers, string? nodeId)
        {
            if (Pointer is not null)
            {
                pointers[Pointer] = nodeId;
            }

            if (Steps is null)
            {
                return;
            }

            foreach (var next in Steps.Values)
            {
                next.AddAllTo(pointers, nodeId);
            }
        }
    }
}
