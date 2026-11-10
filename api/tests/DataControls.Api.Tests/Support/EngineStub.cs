using System.Collections.Concurrent;
using System.Net;
using System.Text;

namespace DataControls.Api.Tests.Support;

/// <summary>
/// Stands in for the engine at the primary handler of the api's HTTP client, so the client and its
/// resilience pipeline stay the real ones. It answers from <c>Fixtures/engine/</c> unless a test tells a
/// route (<c>"POST /run"</c>) to answer, wait or fail, and it records every call.
/// </summary>
public sealed class EngineStub : HttpMessageHandler
{
    public const string Health = "GET /health";
    public const string Glossary = "GET /glossary";
    public const string Validate = "POST /validate";
    public const string Run = "POST /run";
    public const string Suggest = "POST /suggest";

    private const string ProblemContentType = "application/problem+json";

    private readonly ConcurrentDictionary<string, Func<EngineCall, CancellationToken, Task<HttpResponseMessage>>> _routes = new();
    private readonly ConcurrentQueue<EngineCall> _calls = new();

    public EngineStub() => Reset();

    public IReadOnlyList<EngineCall> Calls => [.. _calls];

    public IReadOnlyList<EngineCall> CallsTo(string route) => [.. _calls.Where(call => call.Route == route)];

    /// <summary>Forgets the calls and goes back to the fixture answers.</summary>
    public void Reset()
    {
        _calls.Clear();
        _routes.Clear();
        Answer(Health, HttpStatusCode.OK, EngineFixtures.Read("health.json"));
        Answer(Glossary, HttpStatusCode.OK, EngineFixtures.Read("glossary.json"));
        Answer(Validate, HttpStatusCode.OK, EngineFixtures.Read("validate.json"));
    }

    public void Answer(string route, HttpStatusCode status, string json) =>
        _routes[route] = (_, _) => Task.FromResult(Json(status, json));

    public void Respond(string route, Func<EngineCall, HttpResponseMessage> responder) =>
        _routes[route] = (call, _) => Task.FromResult(responder(call));

    /// <summary>The route refuses the connection: what a stopped engine looks like.</summary>
    public void Refuse(string route) =>
        _routes[route] = (_, _) => throw new HttpRequestException("Connection refused (engine stub).");

    /// <summary>The route answers its fixture only after the delay, unless the call is cancelled first.</summary>
    public void Delay(string route, TimeSpan delay)
    {
        var answer = _routes[route];
        _routes[route] = async (call, cancellationToken) =>
        {
            await Task.Delay(delay, cancellationToken);
            return await answer(call, cancellationToken);
        };
    }

    /// <summary>The route answers as something in front of the engine would: a status and text, no problem document.</summary>
    public void AnswerPlain(string route, HttpStatusCode status) =>
        _routes[route] = (_, _) => Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent("upstream unavailable", Encoding.UTF8, "text/plain") });

    /// <summary>The route sends its headers and then a body that never arrives.</summary>
    public void StallBody(string route) =>
        _routes[route] = (_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StreamContent(new StalledStream()) });

    public void RefuseEverything()
    {
        foreach (var route in new[] { Health, Glossary, Validate, Run, Suggest })
        {
            Refuse(route);
        }
    }

    public static HttpResponseMessage Json(HttpStatusCode status, string json) =>
        new(status)
        {
            Content = new StringContent(json, Encoding.UTF8, (int)status >= 400 ? ProblemContentType : "application/json"),
        };

    private sealed class StalledStream : Stream
    {
        public override bool CanRead => true;

        public override bool CanSeek => false;

        public override bool CanWrite => false;

        public override long Length => throw new NotSupportedException();

        public override long Position
        {
            get => throw new NotSupportedException();
            set => throw new NotSupportedException();
        }

        public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
        {
            await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
            return 0;
        }

        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();

        public override void Flush()
        {
        }

        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();

        public override void SetLength(long value) => throw new NotSupportedException();

        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }

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
        return Json(HttpStatusCode.NotFound, EngineFixtures.Problem("NOT_FOUND", 404));
    }
}
