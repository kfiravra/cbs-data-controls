using System.Collections.Concurrent;
using System.Net;
using System.Text;

namespace DataControls.Api.Tests.Support;

/// <summary>
/// Stands in for the engine at the primary handler of the api's HTTP client, so the client and its
/// resilience pipeline stay the real ones. Records every call and answers per route (<c>"POST /run"</c>).
/// </summary>
public sealed class EngineStub : HttpMessageHandler
{
    private readonly ConcurrentDictionary<string, Func<EngineCall, CancellationToken, Task<HttpResponseMessage>>> _routes = new();
    private readonly ConcurrentQueue<EngineCall> _calls = new();

    public IReadOnlyList<EngineCall> Calls => [.. _calls];

    public IReadOnlyList<EngineCall> CallsTo(string route) => [.. _calls.Where(call => call.Route == route)];

    public void Reset()
    {
        _routes.Clear();
        _calls.Clear();
    }

    public void Answer(string route, HttpStatusCode status, string json, string contentType = "application/json") =>
        _routes[route] = (_, _) => Task.FromResult(Json(status, json, contentType));

    public void Respond(string route, Func<EngineCall, CancellationToken, Task<HttpResponseMessage>> responder) =>
        _routes[route] = responder;

    public static HttpResponseMessage Json(HttpStatusCode status, string json, string contentType = "application/json") =>
        new(status) { Content = new StringContent(json, Encoding.UTF8, contentType) };

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var body = request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync(cancellationToken);
        var headers = request.Headers.ToDictionary(header => header.Key, header => string.Join(",", header.Value), StringComparer.OrdinalIgnoreCase);
        var call = new EngineCall($"{request.Method.Method} {request.RequestUri?.AbsolutePath}", headers, body);
        _calls.Enqueue(call);

        if (_routes.TryGetValue(call.Route, out var responder))
        {
            return await responder(call, cancellationToken);
        }

        // What the engine answers for a path it does not serve.
        return Json(
            HttpStatusCode.NotFound,
            """{"type":"about:blank","title":"NOT_FOUND","status":404,"code":"NOT_FOUND","params":{},"correlationId":"stub"}""",
            "application/problem+json");
    }
}
