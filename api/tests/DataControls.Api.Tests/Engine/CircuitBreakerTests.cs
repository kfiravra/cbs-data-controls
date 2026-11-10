using System.Diagnostics;
using System.Net;
using DataControls.Api.Tests.Support;

namespace DataControls.Api.Tests.Engine;

/// <summary>
/// What opens the circuit breaker and what does not. The breaker's state belongs to the host, so every
/// test here starts a host of its own, with the production minimum of five calls.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class CircuitBreakerTests : IAsyncLifetime
{
    private const int ConcurrentRequests = 6;

    private readonly ApiFactory _factory = new(new Dictionary<string, string>
    {
        ["Engine:AttemptTimeout"] = "00:00:05",
        ["Engine:BreakerMinimumThroughput"] = "5",
        ["Engine:BreakerBreakDuration"] = "00:00:30",
    });

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    [Fact]
    public async Task Engine_calls_fail_fast_without_reaching_the_engine_when_refused_connections_opened_the_breaker()
    {
        var client = _factory.CreateClient();
        _factory.Engine.Refuse(EngineStub.Validate);

        // Each refused request is two attempts, so six at once pass the minimum of five in one sampling window.
        var refused = await ManyAsync(() => ValidateAsync(client));
        var callsWhenOpened = _factory.Engine.Calls.Count;
        var watch = Stopwatch.StartNew();
        var afterOpening = await ValidateAsync(client);

        Assert.All(refused, response => Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode));
        await HttpAssert.ProblemAsync(afterOpening, HttpStatusCode.ServiceUnavailable, "ENGINE_UNAVAILABLE");
        Assert.Equal(callsWhenOpened, _factory.Engine.Calls.Count);
        Assert.InRange(callsWhenOpened, 5, ConcurrentRequests * 2);
        Assert.True(watch.Elapsed < TimeSpan.FromMilliseconds(400), $"An open circuit answered in {watch.Elapsed}.");
    }

    [Fact]
    public async Task Breaker_opens_when_something_in_front_of_the_engine_answers_503_without_a_problem()
    {
        var client = _factory.CreateClient();
        _factory.Engine.AnswerPlain(EngineStub.Validate, HttpStatusCode.ServiceUnavailable);

        await ManyAsync(() => ValidateAsync(client));
        var callsWhenOpened = _factory.Engine.Calls.Count;
        var afterOpening = await ValidateAsync(client);

        await HttpAssert.ProblemAsync(afterOpening, HttpStatusCode.ServiceUnavailable, "ENGINE_UNAVAILABLE");
        Assert.Equal(callsWhenOpened, _factory.Engine.Calls.Count);
    }

    [Fact]
    public async Task Breaker_stays_closed_when_the_engine_itself_answers_that_its_database_is_down()
    {
        var client = _factory.CreateClient();
        _factory.Engine.Answer(EngineStub.Validate, HttpStatusCode.ServiceUnavailable, EngineFixtures.Read("problem-database-unavailable.json"));

        await ManyAsync(() => ValidateAsync(client));
        var callsBefore = _factory.Engine.Calls.Count;
        var stillRelayed = await ValidateAsync(client);
        _factory.Engine.Reset();
        var afterRecovery = await ValidateAsync(client);

        Assert.Equal(ConcurrentRequests * 2, callsBefore);
        await HttpAssert.ProblemAsync(stillRelayed, HttpStatusCode.ServiceUnavailable, "DATABASE_UNAVAILABLE");
        Assert.Equal(HttpStatusCode.OK, afterRecovery.StatusCode);
    }

    [Fact]
    public async Task Breaker_stays_closed_when_only_health_probes_fail()
    {
        var client = _factory.CreateClient();
        _factory.Engine.Refuse(EngineStub.Health);

        var probes = await ManyAsync(() => client.GetAsync("/api/v1/health"));
        var afterProbes = await ValidateAsync(client);

        Assert.All(probes, probe => Assert.Equal(HttpStatusCode.OK, probe.StatusCode));
        Assert.Equal(ConcurrentRequests, _factory.Engine.CallsTo(EngineStub.Health).Count);
        Assert.Equal(HttpStatusCode.OK, afterProbes.StatusCode);
    }

    private static Task<HttpResponseMessage[]> ManyAsync(Func<Task<HttpResponseMessage>> send) =>
        Task.WhenAll(Enumerable.Range(0, ConcurrentRequests).Select(_ => send()));

    private static Task<HttpResponseMessage> ValidateAsync(HttpClient client) =>
        client.PostAsync("/api/v1/controls/validate", Body.Definition(Examples.Definition(Examples.First)));
}
