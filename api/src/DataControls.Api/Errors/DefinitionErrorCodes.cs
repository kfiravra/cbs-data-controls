namespace DataControls.Api.Errors;

/// <summary>The definition error codes the api itself reports; every other one is the engine's and is relayed.</summary>
public static class DefinitionErrorCodes
{
    public const string SchemaViolation = "SCHEMA_VIOLATION";
    public const string UnsupportedSchemaVersion = "UNSUPPORTED_SCHEMA_VERSION";
}
