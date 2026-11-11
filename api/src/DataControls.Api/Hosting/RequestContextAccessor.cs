namespace DataControls.Api.Hosting;

public sealed class RequestContextAccessor(IHttpContextAccessor http, SupportedLanguages languages)
{
    /// <summary>The current request's context; outside a request, a new correlation id and the default language.</summary>
    public RequestContext Current =>
        http.HttpContext?.Features.Get<RequestContext>()
        ?? new RequestContext(CorrelationId.Create(), languages.Default);
}
