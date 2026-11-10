using System.Diagnostics;
using System.Net;
using DataControls.Api.Tests.Support;

namespace DataControls.Api.Tests.Engine;

/// <summary>The breaker's state belongs to the host, so this test opens it on a host of its own.</summary>
[Collection(ApiCollection.Name)]
public sealed class CircuitBreakerTests
{
    private const int ConcurrentRequests = 6;

    [Fact]
    public async Task Engine_calls_fail_fast_without_reaching_the_engine_when_the_breaker_has_opened()
    {
        await using var factory = new ApiFactory(new Dictionary<string, string>
        {
            ["Engine:AttemptTimeout"] = "00:00:05",
            ["Engine:BreakerMinimumThroughput"] = "5",
            ["Engine:BreakerBreakDuration"] = "00:00:30",
        });
        var client = factory.CreateClient();
        factory.Engine.Refuse(EngineStub.Validate);

        // Each refused request is two attempts, so six at once pass the minimum of five in one sampling window.
        var refused = await Task.WhenAll(Enumerable.Range(0, ConcurrentRequests).Select(_ => ValidateAsync(client)));
        var callsWhenOpened = factory.Engine.Calls.Count;
        var watch = Stopwatch.StartNew();
        var afterOpening = await ValidateAsync(client);

        Assert.All(refused, response => Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode));
        await HttpAssert.ProblemAsync(afterOpening, HttpStatusCode.ServiceUnavailable, "ENGINE_UNAVAILABLE");
        Assert.Equal(callsWhenOpened, factory.Engine.Calls.Count);
        Assert.InRange(callsWhenOpened, 5, ConcurrentRequests * 2);
        Assert.True(watch.Elapsed < TimeSpan.FromMilliseconds(400), $"An open circuit answered in {watch.Elapsed}.");
    }

    private static Task<HttpResponseMessage> ValidateAsync(HttpClient client) =>
        client.PostAsync("/api/v1/controls/validate", Body.Definition(Examples.Definition(Examples.First)));
}
