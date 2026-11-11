using System.Text.Json;
using System.Text.Json.Serialization;

namespace DataControls.Api.Errors;

/// <summary>
/// The body of every response that is not 2xx: a code and its params, never prose. The problem writer
/// serialises this type and the OpenAPI document describes it, so the two cannot drift. <c>Errors</c> is
/// present with <c>REQUEST_INVALID</c> and <c>DEFINITION_INVALID</c> only, and absent otherwise, never null.
/// </summary>
public sealed record ProblemResponse(
    string Type,
    string Title,
    int Status,
    string Code,
    JsonElement Params,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] JsonElement? Errors,
    string CorrelationId);
