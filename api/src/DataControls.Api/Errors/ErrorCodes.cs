namespace DataControls.Api.Errors;

/// <summary>The codes of <c>contracts/errors.md</c> that the api answers with or stores on a run.</summary>
public static class ErrorCodes
{
    public const string RequestInvalid = "REQUEST_INVALID";
    public const string DefinitionInvalid = "DEFINITION_INVALID";
    public const string ControlNotFound = "CONTROL_NOT_FOUND";
    public const string VersionNotFound = "VERSION_NOT_FOUND";
    public const string RunNotFound = "RUN_NOT_FOUND";
    public const string NotFound = "NOT_FOUND";
    public const string ControlArchived = "CONTROL_ARCHIVED";
    public const string ConcurrencyConflict = "CONCURRENCY_CONFLICT";
    public const string EngineUnavailable = "ENGINE_UNAVAILABLE";
    public const string DatabaseUnavailable = "DATABASE_UNAVAILABLE";
    public const string QueryTimeout = "QUERY_TIMEOUT";
    public const string InternalError = "INTERNAL_ERROR";
    public const string ControlDefinitionOutdated = "CONTROL_DEFINITION_OUTDATED";

    /// <summary>The status of every code the api sends as a problem.</summary>
    public static IReadOnlyDictionary<string, int> ProblemStatus { get; } = new Dictionary<string, int>
    {
        [RequestInvalid] = StatusCodes.Status400BadRequest,
        [DefinitionInvalid] = StatusCodes.Status422UnprocessableEntity,
        [ControlNotFound] = StatusCodes.Status404NotFound,
        [VersionNotFound] = StatusCodes.Status404NotFound,
        [RunNotFound] = StatusCodes.Status404NotFound,
        [NotFound] = StatusCodes.Status404NotFound,
        [ControlArchived] = StatusCodes.Status409Conflict,
        [ConcurrencyConflict] = StatusCodes.Status409Conflict,
        [EngineUnavailable] = StatusCodes.Status503ServiceUnavailable,
        [DatabaseUnavailable] = StatusCodes.Status503ServiceUnavailable,
        [QueryTimeout] = StatusCodes.Status504GatewayTimeout,
        [InternalError] = StatusCodes.Status500InternalServerError,
    };

    /// <summary>The codes a failed run may carry as its error.</summary>
    public static IReadOnlySet<string> RunErrors { get; } = new HashSet<string>
    {
        EngineUnavailable,
        DatabaseUnavailable,
        QueryTimeout,
        InternalError,
        ControlDefinitionOutdated,
    };
}
