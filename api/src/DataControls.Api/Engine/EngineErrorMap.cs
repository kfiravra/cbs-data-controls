using System.Text.Json;
using DataControls.Api.Errors;
using DataControls.Api.Hosting;
using DataControls.Api.Persistence;

namespace DataControls.Api.Engine;

/// <summary>
/// The one table of what an engine failure becomes: a problem in a request (validate, save, suggestions),
/// a status and an error on a run. It follows "Engine failures" in <c>contracts/api.md</c>.
/// </summary>
internal static class EngineErrorMap
{
    private static readonly IReadOnlyDictionary<EngineFailure, Row> _rows = new Dictionary<EngineFailure, Row>
    {
        [EngineFailure.DefinitionInvalid] = new(ErrorCodes.DefinitionInvalid, RunStatus.Failed, ErrorCodes.ControlDefinitionOutdated),
        [EngineFailure.QueryTimeout] = new(ErrorCodes.QueryTimeout, RunStatus.TimedOut, ErrorCodes.QueryTimeout),
        [EngineFailure.DatabaseUnavailable] = new(ErrorCodes.DatabaseUnavailable, RunStatus.Failed, ErrorCodes.DatabaseUnavailable),
        [EngineFailure.Unavailable] = new(ErrorCodes.EngineUnavailable, RunStatus.Failed, ErrorCodes.EngineUnavailable),
        [EngineFailure.Unexpected] = new(ErrorCodes.InternalError, RunStatus.Failed, ErrorCodes.InternalError),
    };

    /// <summary>The problem a request answers with. The engine's errors and params travel unchanged.</summary>
    public static ApiException ToProblem(EngineException failure)
    {
        var code = _rows[failure.Failure].RequestCode;
        return failure.Failure switch
        {
            EngineFailure.DefinitionInvalid => ApiException.Relayed(code, errors: failure.Errors),
            EngineFailure.QueryTimeout => ApiException.Relayed(code, parameters: failure.Params),
            _ => ApiException.Relayed(code),
        };
    }

    /// <summary>How a run that met this failure is closed.</summary>
    public static RunFailure ToRunFailure(EngineException failure)
    {
        var row = _rows[failure.Failure];
        var parameters = failure.Failure switch
        {
            EngineFailure.DefinitionInvalid when failure.Errors is { } errors => Wrap("errors", errors),
            EngineFailure.QueryTimeout when failure.Params is { ValueKind: JsonValueKind.Object } engineParams => engineParams.GetRawText(),
            _ => "{}",
        };
        return new RunFailure(row.RunStatus, row.RunCode, parameters);
    }

    private static string Wrap(string name, JsonElement value)
    {
        using var buffer = new MemoryStream();
        using (var writer = new Utf8JsonWriter(buffer, JsonDefaults.WriterOptions))
        {
            writer.WriteStartObject();
            writer.WritePropertyName(name);
            value.WriteTo(writer);
            writer.WriteEndObject();
        }

        return System.Text.Encoding.UTF8.GetString(buffer.ToArray());
    }

    private sealed record Row(string RequestCode, RunStatus RunStatus, string RunCode);
}
