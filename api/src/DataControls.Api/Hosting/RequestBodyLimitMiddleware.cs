using DataControls.Api.Errors;

namespace DataControls.Api.Hosting;

/// <summary>
/// Refuses a body that declares more than the limit before anything reads it. A body without a declared
/// length is cut off by the server's own limit, which the exception handler answers the same way.
/// </summary>
internal sealed class RequestBodyLimitMiddleware(RequestDelegate next)
{
    public const long MaxBodyBytes = 1024 * 1024;

    public Task InvokeAsync(HttpContext context)
    {
        if (context.Request.ContentLength > MaxBodyBytes)
        {
            throw ApiException.RequestRejected(StatusCodes.Status413PayloadTooLarge);
        }

        return next(context);
    }
}
