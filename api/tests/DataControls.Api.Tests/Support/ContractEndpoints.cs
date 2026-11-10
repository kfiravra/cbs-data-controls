using System.Text.RegularExpressions;

namespace DataControls.Api.Tests.Support;

/// <summary>
/// The rows of the application table of <c>contracts/api.md</c> (§4), read with the regular expression the
/// contract itself gives for it, plus the statuses each row names.
/// </summary>
internal static partial class ContractEndpoints
{
    private const string ApplicationPrefix = "/api/v1";

    public static IReadOnlyList<ContractEndpoint> Application { get; } =
        [.. ContractFiles.Read("api.md").Split('\n')
            .Select(line => (Line: line, Match: Row().Match(line)))
            .Where(row => row.Match.Success && row.Match.Groups["path"].Value.StartsWith(ApplicationPrefix, StringComparison.Ordinal))
            .Select(row => Read(row.Line, row.Match))];

    private static ContractEndpoint Read(string line, Match match)
    {
        var cells = line.Trim().Trim('|').Split('|').Select(cell => cell.Trim()).ToArray();
        var success = int.Parse(Status().Match(cells[2]).Value);
        // The one row without errors says "none: always 200", which names no error status.
        IEnumerable<int> errors = cells[3].StartsWith("none", StringComparison.Ordinal)
            ? []
            : Status().Matches(cells[3]).Select(status => int.Parse(status.Value)).Distinct();
        return new ContractEndpoint(match.Groups["method"].Value, match.Groups["path"].Value, success, [.. errors]);
    }

    [GeneratedRegex(@"^\| `(?<method>GET|POST|PUT|DELETE) (?<path>/[^`]*)` \|")]
    private static partial Regex Row();

    [GeneratedRegex(@"\b[1-5]\d{2}\b")]
    private static partial Regex Status();
}
