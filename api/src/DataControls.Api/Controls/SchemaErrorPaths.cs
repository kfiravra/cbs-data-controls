namespace DataControls.Api.Controls;

/// <summary>
/// Turns JsonSchema.Net's error units into the paths <c>contracts/errors.md</c> (Schema violations) asks
/// for, which are the ones Python's jsonschema reports in the engine. Three corrections, each seen in
/// the probe of both validators (<c>dev/completed/dc-api/research/schema-probe.md</c>).
/// </summary>
internal static class SchemaErrorPaths
{
    // Keywords whose inner failures are not failures of the document: a failed `if` only selects no
    // `then`, and what fails inside `not`, `anyOf` or `oneOf` has no single location.
    private static readonly HashSet<string> _testKeywords = ["if", "not", "anyOf", "oneOf"];

    // Keywords followed by a name the schema author chose, which may spell like a keyword.
    private static readonly HashSet<string> _namedChildKeywords = ["properties", "patternProperties", "dependentSchemas", "$defs"];

    /// <summary>One path per distinct location, in the order the units came.</summary>
    public static IReadOnlyList<string> From(IEnumerable<SchemaErrorUnit> units) =>
        [.. units
            .Where(unit => !IsInsideTest(unit.EvaluationPath))
            .Select(unit => unit.FromFalseSchema ? Parent(unit.InstanceLocation) : unit.InstanceLocation)
            .Distinct()];

    private static bool IsInsideTest(string evaluationPath)
    {
        var segments = evaluationPath.Split('/', StringSplitOptions.RemoveEmptyEntries);
        for (var index = 0; index < segments.Length; index++)
        {
            if (_namedChildKeywords.Contains(segments[index]))
            {
                index++;
            }
            else if (_testKeywords.Contains(segments[index]))
            {
                return true;
            }
        }

        return false;
    }

    /// <summary>
    /// A member forbidden with <c>false</c> is reported at the member; the contract, like Python, names the
    /// object that holds it.
    /// </summary>
    private static string Parent(string pointer)
    {
        var lastSeparator = pointer.LastIndexOf('/');
        return lastSeparator < 0 ? pointer : pointer[..lastSeparator];
    }
}
