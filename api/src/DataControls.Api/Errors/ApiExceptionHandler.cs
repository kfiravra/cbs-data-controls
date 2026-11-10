using DataControls.Api.Engine;
using DataControls.Api.Hosting;
using DataControls.Api.Persistence;
using Microsoft.AspNetCore.Diagnostics;

namespace DataControls.Api.Errors;

/// <summary>The one mapping from an exception to a problem. Details are logged, never returned.</summary>
internal sealed class ApiExceptionHandler(
    ProblemWriter writer,
    RequestContextAccessor requests,
    ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is OperationCanceledException && httpContext.RequestAborted.IsCancellationRequested)
        {
            // The client has gone; there is nobody to answer.
            return true;
        }

        await writer.WriteAsync(httpContext, Translate(exception), cancellationToken);
        return true;
    }

    private ApiException Translate(Exception exception)
    {
        switch (exception)
        {
            case ApiException problem:
                return problem;
            case BadHttpRequestException { StatusCode: StatusCodes.Status413PayloadTooLarge }:
                return ApiException.RequestRejected(StatusCodes.Status413PayloadTooLarge);
            case BadHttpRequestException:
                return ApiException.RequestRejected(StatusCodes.Status400BadRequest);
        }

        var correlationId = requests.Current.CorrelationId;
        if (exception is EngineException engineFailure)
        {
            logger.LogWarning(exception, "Engine call failed {Failure} {CorrelationId}", engineFailure.Failure, correlationId);
            return EngineErrorMap.ToProblem(engineFailure);
        }

        if (SqlFailure.IsConnectionLevel(exception))
        {
            logger.LogWarning(exception, "The dq database did not answer {CorrelationId}", correlationId);
            return ApiException.DatabaseUnavailable();
        }

        logger.LogError(exception, "Unhandled exception {CorrelationId}", correlationId);
        return ApiException.Internal();
    }
}
