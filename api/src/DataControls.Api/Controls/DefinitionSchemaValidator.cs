using System.Text.Json;
using DataControls.Api.Errors;
using Json.Schema;

namespace DataControls.Api.Controls;

/// <summary>
/// Validates a definition against <c>contracts/control-definition.schema.json</c>, embedded at build
/// time, with JsonSchema.Net 8.0.5 (pinned: its last MIT release). The class is the only code that
/// knows the library.
/// </summary>
internal sealed class DefinitionSchemaValidator(ILogger<DefinitionSchemaValidator> logger) : IDefinitionSchemaValidator
{
    private const string ResourceName = "control-definition.schema.json";
    private const string VersionMember = "schemaVersion";
    private const string VersionPath = "/schemaVersion";
    private const double SupportedVersion = 1;

    // An empty key is how the library marks the error of a `false` subschema.
    private const string FalseSchemaErrorKey = "";

    // Built once per process: the library registers a schema by its $id and refuses to register it twice.
    private static readonly Lazy<JsonSchema> _schema = new(Load);

    private static readonly EvaluationOptions _listOutput = new() { OutputFormat = OutputFormat.List };

    public IReadOnlyList<DefinitionError> Validate(JsonElement definition)
    {
        if (HasUnsupportedVersion(definition))
        {
            return [new DefinitionError(DefinitionErrorCodes.UnsupportedSchemaVersion, VersionPath, null)];
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
            logger.LogWarning("The schema rejected a definition without a located error; reporting it at the root");
            paths = [string.Empty];
        }

        var positions = DefinitionDocument.PositionsOf(definition);
        return [.. paths
            .OrderBy(path => positions.GetValueOrDefault(path, int.MaxValue))
            .Select(path => new DefinitionError(
                DefinitionErrorCodes.SchemaViolation,
                path,
                DefinitionDocument.NearestNodeId(definition, path)))];
    }

    /// <summary>Decided before the schema, as the engine does: a version that is present and is not the number 1.</summary>
    private static bool HasUnsupportedVersion(JsonElement definition) =>
        definition.ValueKind == JsonValueKind.Object
        && definition.TryGetProperty(VersionMember, out var version)
        && !(version.ValueKind == JsonValueKind.Number && version.TryGetDouble(out var number) && number == SupportedVersion);

    private static IEnumerable<SchemaErrorUnit> ErrorUnits(EvaluationResults results) =>
        (results.Details ?? [])
            .Where(unit => unit.Errors is { Count: > 0 })
            .Select(unit => new SchemaErrorUnit(
                unit.InstanceLocation.ToString(),
                unit.EvaluationPath.ToString(),
                unit.Errors!.ContainsKey(FalseSchemaErrorKey)));

    private static JsonSchema Load()
    {
        using var stream = typeof(DefinitionSchemaValidator).Assembly.GetManifestResourceStream(ResourceName)
            ?? throw new InvalidOperationException($"The embedded resource {ResourceName} is missing from the build.");
        using var reader = new StreamReader(stream);
        return JsonSchema.FromText(reader.ReadToEnd());
    }
}
