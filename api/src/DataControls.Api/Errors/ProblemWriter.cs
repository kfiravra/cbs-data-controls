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
    private const string ProblemType = "about:blank";

    public Task WriteAsync(HttpContext context, ApiException problem, CancellationToken cancellationToken)
    {
        context.Response.StatusCode = problem.Status;
        context.Response.ContentType = ContentType;
        var body = new ProblemResponse(
            ProblemType,
            problem.Code,
            problem.Status,
            problem.Code,
            problem.Params,
            problem.Errors,
            requests.Current.CorrelationId);
        return JsonSerializer.SerializeAsync(context.Response.Body, body, JsonDefaults.Options, cancellationToken);
    }
}
