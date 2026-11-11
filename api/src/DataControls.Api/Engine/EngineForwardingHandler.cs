using System.Net.Http.Headers;
using DataControls.Api.Hosting;

namespace DataControls.Api.Engine;

/// <summary>
/// Puts the request's correlation id and its resolved language (not the raw header) on every engine
/// call. Outside a request the accessor gives a new id and the default language.
/// </summary>
internal sealed class EngineForwardingHandler(RequestContextAccessor requests) : DelegatingHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var context = requests.Current;
        request.Headers.Remove(CorrelationId.HeaderName);
        request.Headers.Add(CorrelationId.HeaderName, context.CorrelationId);
        request.Headers.AcceptLanguage.Clear();
        request.Headers.AcceptLanguage.Add(new StringWithQualityHeaderValue(context.Language));
        return base.SendAsync(request, cancellationToken);
    }
}
