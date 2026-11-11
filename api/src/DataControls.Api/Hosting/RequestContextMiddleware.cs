namespace DataControls.Api.Hosting;

/// <summary>Gives the request its correlation id and its language, and returns the id on every response.</summary>
internal sealed class RequestContextMiddleware(
    RequestDelegate next,
    SupportedLanguages languages,
    ILogger<RequestContextMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = CorrelationId.AcceptOrCreate(context.Request.Headers[CorrelationId.HeaderName]);
        var language = languages.Resolve(context.Request.Headers.AcceptLanguage);
        context.Features.Set(new RequestContext(correlationId, language));

        // The exception handler clears the response before it writes a problem, so the header is set
        // when the response starts, not here.
        context.Response.OnStarting(() =>
        {
            context.Response.Headers[CorrelationId.HeaderName] = correlationId;
            return Task.CompletedTask;
        });

        using (logger.BeginScope(new Dictionary<string, object> { ["CorrelationId"] = correlationId }))
        {
            await next(context);
        }
    }
}
