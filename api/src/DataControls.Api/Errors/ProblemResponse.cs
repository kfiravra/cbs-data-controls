using System.Text.Json;

namespace DataControls.Api.Errors;

/// <summary>
/// The shape of every response that is not 2xx, for the OpenAPI document. <c>Errors</c> is present with
/// <c>REQUEST_INVALID</c> and <c>DEFINITION_INVALID</c> only. The body itself is written by the problem writer.
/// </summary>
public sealed record ProblemResponse(
    string Type,
    string Title,
    int Status,
    string Code,
    JsonElement Params,
    JsonElement? Errors,
    string CorrelationId);
