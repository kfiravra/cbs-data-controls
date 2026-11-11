using System.Text.Json;

namespace DataControls.Api.Engine;

/// <summary>
/// One failed engine call. A request relays it as a problem and a run records it as its error; both
/// read the same table (<see cref="EngineErrorMap"/>).
/// </summary>
public sealed class EngineException : Exception
{
    private const string DefinitionInvalidCode = "DEFINITION_INVALID";
    private const string QueryTimeoutCode = "QUERY_TIMEOUT";
    private const string DatabaseUnavailableCode = "DATABASE_UNAVAILABLE";

    private EngineException(EngineFailure failure, string message, Exception? inner = null, JsonElement? parameters = null, JsonElement? errors = null)
        : base(message, inner)
    {
        Failure = failure;
        Params = parameters;
        Errors = errors;
    }

    public EngineFailure Failure { get; }

    /// <summary>The engine's <c>params</c>, when its answer was a problem.</summary>
    public JsonElement? Params { get; }

    /// <summary>The engine's definition errors, with <see cref="EngineFailure.DefinitionInvalid"/>.</summary>
    public JsonElement? Errors { get; }

    public static EngineException Unavailable(Exception inner) =>
        new(EngineFailure.Unavailable, "The engine did not answer.", inner);

    public static EngineException Unexpected(string what, Exception? inner = null) =>
        new(EngineFailure.Unexpected, $"The engine answered outside the contract: {what}.", inner);

    /// <summary>Reads a response that is not 2xx: the engine's own code when the body is a problem.</summary>
    public static EngineException FromResponse(int status, ReadOnlyMemory<byte> body)
    {
        try
        {
            using var document = JsonDocument.Parse(body);
            var problem = document.RootElement;
            if (problem.ValueKind == JsonValueKind.Object
                && problem.TryGetProperty("code", out var code)
                && code.ValueKind == JsonValueKind.String)
            {
                var parameters = problem.TryGetProperty("params", out var found) ? found.Clone() : (JsonElement?)null;
                var errors = problem.TryGetProperty("errors", out found) ? found.Clone() : (JsonElement?)null;
                return (status, code.GetString()) switch
                {
                    (StatusCodes.Status422UnprocessableEntity, DefinitionInvalidCode) when errors is { ValueKind: JsonValueKind.Array } =>
                        new(EngineFailure.DefinitionInvalid, "The engine rejected the definition.", errors: errors),
                    (StatusCodes.Status504GatewayTimeout, QueryTimeoutCode) =>
                        new(EngineFailure.QueryTimeout, "A statement timed out in the engine.", parameters: parameters),
                    (StatusCodes.Status503ServiceUnavailable, DatabaseUnavailableCode) =>
                        new(EngineFailure.DatabaseUnavailable, "The engine's database did not answer."),
                    _ => Unexpected($"status {status} with the code {code.GetString()}"),
                };
            }
        }
        catch (JsonException)
        {
            // Not JSON at all: reported below like any other answer outside the contract.
        }

        return Unexpected($"status {status} without a problem body");
    }
}
