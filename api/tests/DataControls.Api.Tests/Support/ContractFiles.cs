using System.Text.RegularExpressions;

namespace DataControls.Api.Tests.Support;

/// <summary>Reads <c>contracts/</c> as copied beside the tests: the source of expected values.</summary>
internal static partial class ContractFiles
{
    public static string Root { get; } = Path.Combine(AppContext.BaseDirectory, "contracts");

    public static string Read(string relativePath) => File.ReadAllText(Path.Combine(Root, relativePath));

    /// <summary>
    /// The rows of the catalogue table under one <c>##</c> heading of <c>errors.md</c>, each split into its
    /// cells; the first cell is the code without its backticks.
    /// </summary>
    public static IReadOnlyList<string[]> ErrorTable(string heading)
    {
        var rows = new List<string[]>();
        var inSection = false;
        foreach (var line in Read("errors.md").Split('\n'))
        {
            if (line.StartsWith("## ", StringComparison.Ordinal))
            {
                inSection = line.Trim() == $"## {heading}";
                continue;
            }

            if (inSection && CodeRow().IsMatch(line))
            {
                var cells = line.Trim().Trim('|').Split('|').Select(cell => cell.Trim()).ToArray();
                cells[0] = cells[0].Trim('`');
                rows.Add(cells);
            }
        }

        return rows;
    }

    [GeneratedRegex(@"^\| `([A-Za-z_]+)` \|")]
    private static partial Regex CodeRow();
}
