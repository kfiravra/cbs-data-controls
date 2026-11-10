using System.Text.Json;
using DataControls.Api.Hosting;

namespace DataControls.Api.Errors;

/// <summary>
/// The one failure type of the api: a status, a code and parameters, never prose. The exception handler
/// writes it as a problem.
/// </summary>
public sealed class ApiException : Exception
{
    private static readonly JsonElement _noParams = JsonSerializer.SerializeToElement(new { });

    private ApiException(string code, object? parameters = null, JsonElement? errors = null, int? status = null)
        : base(code)
    {
        Code = code;
        Status = status ?? ErrorCodes.ProblemStatus[code];
        Params = parameters switch
        {
            null => _noParams,
            JsonElement element => element,
            _ => JsonSerializer.SerializeToElement(parameters, JsonDefaults.Options),
        };
        Errors = errors;
    }

    public int Status { get; }

    public string Code { get; }

    public JsonElement Params { get; }

    public JsonElement? Errors { get; }

    public static ApiException NotFound() => new(ErrorCodes.NotFound);

    public static ApiException ControlNotFound(long id) => new(ErrorCodes.ControlNotFound, new { id });

    public static ApiException VersionNotFound(long id, long version) => new(ErrorCodes.VersionNotFound, new { id, version });

    public static ApiException RunNotFound(long id) => new(ErrorCodes.RunNotFound, new { id });

    /// <summary>An archived control can be read but not changed or run.</summary>
    public static ApiException ControlArchived(int id) => new(ErrorCodes.ControlArchived, new { id });

    /// <summary>The control was saved by someone else since the client read it.</summary>
    public static ApiException ConcurrencyConflict(int id) => new(ErrorCodes.ConcurrencyConflict, new { id });

    public static ApiException RequestInvalid(IReadOnlyList<RequestError> errors) =>
        new(ErrorCodes.RequestInvalid, errors: JsonSerializer.SerializeToElement(errors, JsonDefaults.Options));

    /// <summary>A request with one fault that is found after the others were checked.</summary>
    public static ApiException RequestInvalid(string path, string code) =>
        RequestInvalid([new RequestError(path, code, new RequestErrorParams())]);

    /// <summary>A request refused before its members were read: 413 for its size, 415 for its media type.</summary>
    public static ApiException RequestRejected(int status) => new(ErrorCodes.RequestInvalid, status: status);

    /// <summary>A definition that fails the api's own layer: the schema version or the schema.</summary>
    public static ApiException DefinitionInvalid(IReadOnlyList<DefinitionError> errors) =>
        new(ErrorCodes.DefinitionInvalid, errors: JsonSerializer.SerializeToElement(errors, JsonDefaults.Options));

    /// <summary>An engine answer passed on: the code of the error map with the engine's own params and errors.</summary>
    public static ApiException Relayed(string code, JsonElement? parameters = null, JsonElement? errors = null) =>
        new(code, parameters, errors);

    public static ApiException DatabaseUnavailable() => new(ErrorCodes.DatabaseUnavailable);

    public static ApiException Internal() => new(ErrorCodes.InternalError);
}
