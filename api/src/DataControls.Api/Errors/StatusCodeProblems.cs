using Microsoft.AspNetCore.Diagnostics;

namespace DataControls.Api.Errors;

/// <summary>
/// Gives a body to an error status that the framework set without one (a media type MVC cannot read, a
/// path nothing serves), so every response that is not 2xx is a problem.
/// </summary>
internal static class StatusCodeProblems
{
    public static Task WriteAsync(StatusCodeContext context)
    {
        var http = context.HttpContext;
        var problem = http.Response.StatusCode switch
        {
            StatusCodes.Status404NotFound or StatusCodes.Status405MethodNotAllowed => ApiException.NotFound(),
            StatusCodes.Status413PayloadTooLarge => ApiException.RequestRejected(StatusCodes.Status413PayloadTooLarge),
            StatusCodes.Status415UnsupportedMediaType => ApiException.RequestRejected(StatusCodes.Status415UnsupportedMediaType),
            >= StatusCodes.Status500InternalServerError => ApiException.Internal(),
            _ => ApiException.RequestRejected(StatusCodes.Status400BadRequest),
        };
        return http.RequestServices.GetRequiredService<ProblemWriter>().WriteAsync(http, problem, http.RequestAborted);
    }
}
