using System.Text.Json;
using DataControls.Api.Hosting;

namespace DataControls.Api.Errors;

/// <summary>
/// The one place a problem is written: <c>{ type, title, status, code, params, errors?, correlationId }</c>.
/// No detail, no instance, no trace id.
/// </summary>
internal sealed class ProblemWriter(RequestContextAccessor requests)
{
    private const string ContentType = "application/problem+json";

    public async Task WriteAsync(HttpContext context, ApiException problem, CancellationToken cancellationToken)
    {
        context.Response.StatusCode = problem.Status;
        context.Response.ContentType = ContentType;

        await using var writer = new Utf8JsonWriter(context.Response.BodyWriter, JsonDefaults.WriterOptions);
        writer.WriteStartObject();
        writer.WriteString("type", "about:blank");
        writer.WriteString("title", problem.Code);
        writer.WriteNumber("status", problem.Status);
        writer.WriteString("code", problem.Code);
        writer.WritePropertyName("params");
        problem.Params.WriteTo(writer);
        if (problem.Errors is { } errors)
        {
            writer.WritePropertyName("errors");
            errors.WriteTo(writer);
        }

        writer.WriteString("correlationId", requests.Current.CorrelationId);
        writer.WriteEndObject();
        await writer.FlushAsync(cancellationToken);
    }
}
