using System.Text.Json;
using DataControls.Api.Errors;
using DataControls.Api.Hosting;
using Json.Schema;

namespace DataControls.Api.Controls;

/// <summary>
/// Validates a definition against <c>contracts/control-definition.schema.json</c>, embedded at build
/// time, with JsonSchema.Net 8.0.5 (pinned: its last MIT release). The class is the only code that
/// knows the library.
/// </summary>
internal sealed class DefinitionSchemaValidator(
    RequestContextAccessor requests,
    ILogger<DefinitionSchemaValidator> logger) : IDefinitionSchemaValidator
{
    private const string ResourceName = "control-definition.schema.json";
    private const string VersionMember = "schemaVersion";
    private const string VersionPath = "/schemaVersion";
    private const double SupportedVersion = 1;

    // An empty key is how the library marks the error of a `false` subschema.
    private const string FalseSchemaErrorKey = "";

    // What this layer evaluates: at most this many nodes (objects and arrays that are items of an array)
    // and this many JSON values in all. The library spends about half a millisecond and 50 KB on a node
    // that fails, so 50,000 empty children, a body of 150 KB, cost 23 seconds and 2.4 GB of allocations.
    // The first number is eight times the glossary's 30 conditions: past it the engine too stops listing
    // schema errors and answers with the limit's own error.
    private const int MaxEvaluatedNodes = 240;
    private const int MaxEvaluatedValues = 10_000;

    // Built once per process: the library registers a schema by its $id and refuses to register it twice.
    private static readonly Lazy<JsonSchema> _schema = new(Load);

    private static readonly EvaluationOptions _listOutput = new() { OutputFormat = OutputFormat.List };

    public IReadOnlyList<DefinitionError> Validate(JsonElement definition)
    {
        if (HasUnsupportedVersion(definition))
        {
            return [new DefinitionError(DefinitionErrorCodes.UnsupportedSchemaVersion, VersionPath, null)];
        }

        if (!IsEvaluated(definition))
        {
            // Not a pass: the engine checks the schema as well, and nothing is saved before it has answered.
            logger.LogInformation(
                "A definition was left to the engine's schema check: too large for this layer, or it holds a number the schema library cannot compare {CorrelationId}",
                requests.Current.CorrelationId);
            return [];
        }

        var results = _schema.Value.Evaluate(definition, _listOutput);
        if (results.IsValid)
        {
            return [];
        }

        var paths = SchemaErrorPaths.From(ErrorUnits(results));
        if (paths.Count == 0)
        {
            // The schema promises a located error for every failure (no not, anyOf or oneOf). If it ever
            // breaks that promise the definition is still refused, at the root.
            logger.LogWarning(
                "The schema rejected a definition without a located error; reporting it at the root {CorrelationId}",
                requests.Current.CorrelationId);
            paths = [string.Empty];
        }

        return [.. DefinitionDocument.Locate(definition, paths)
            .Select(located => new DefinitionError(DefinitionErrorCodes.SchemaViolation, located.Pointer, located.NodeId))];
    }

    /// <summary>Decided before the schema, as the engine does: a version that is present and is not the number 1.</summary>
    private static bool HasUnsupportedVersion(JsonElement definition) =>
        definition.ValueKind == JsonValueKind.Object
        && definition.TryGetProperty(VersionMember, out var version)
        && !(version.ValueKind == JsonValueKind.Number && version.TryGetDouble(out var number) && number == SupportedVersion);

    /// <summary>
    /// Whether the schema library is given the definition: it is within the two limits, and every number
    /// in it fits a decimal (const, enum and uniqueItems compare numbers as decimals, and the library
    /// throws on one that does not).
    /// </summary>
    private static bool IsEvaluated(JsonElement definition)
    {
        var nodes = 0;
        var values = 0;
        return IsEvaluated(definition, isItem: false, ref nodes, ref values);
    }

    private static bool IsEvaluated(JsonElement element, bool isItem, ref int nodes, ref int values)
    {
        if (++values > MaxEvaluatedValues)
        {
            return false;
        }

        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                if (isItem && ++nodes > MaxEvaluatedNodes)
                {
                    return false;
                }

                foreach (var member in element.EnumerateObject())
                {
                    if (!IsEvaluated(member.Value, isItem: false, ref nodes, ref values))
                    {
                        return false;
                    }
                }

                return true;
            case JsonValueKind.Array:
                if (isItem && ++nodes > MaxEvaluatedNodes)
                {
                    return false;
                }

                foreach (var item in element.EnumerateArray())
                {
                    if (!IsEvaluated(item, isItem: true, ref nodes, ref values))
                    {
                        return false;
                    }
                }

                return true;
            case JsonValueKind.Number:
                return element.TryGetDecimal(out _);
            default:
                return true;
        }
    }

    private static IEnumerable<SchemaErrorUnit> ErrorUnits(EvaluationResults results)
    {
        foreach (var unit in results.Details ?? [])
        {
            if (unit.Errors is { Count: > 0 } errors)
            {
                yield return new SchemaErrorUnit(
                    unit.InstanceLocation.ToString(),
                    unit.EvaluationPath.ToString(),
                    errors.ContainsKey(FalseSchemaErrorKey));
            }
        }
    }

    private static JsonSchema Load()
    {
        using var stream = typeof(DefinitionSchemaValidator).Assembly.GetManifestResourceStream(ResourceName)
            ?? throw new InvalidOperationException($"The embedded resource {ResourceName} is missing from the build.");
        using var reader = new StreamReader(stream);
        return JsonSchema.FromText(reader.ReadToEnd());
    }
}
