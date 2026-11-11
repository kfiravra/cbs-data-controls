using System.Net;
using System.Text.Json.Nodes;
using DataControls.Api.Tests.Support;

namespace DataControls.Api.Tests.Glossary;

/// <summary>The glossary cache lives as long as its host, so each test starts a host of its own.</summary>
[Collection(ApiCollection.Name)]
public sealed class GlossaryTests : IAsyncLifetime
{
    private const string Path = "/api/v1/glossary";

    private readonly ApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    [Fact]
    public async Task Glossary_is_the_engine_body_byte_for_byte_and_fetched_once_when_read_twice()
    {
        var client = _factory.CreateClient();

        var first = await client.GetAsync(Path);
        var second = await client.GetAsync(Path);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal("application/json", first.Content.Headers.ContentType?.MediaType);
        Assert.Equal(EngineFixtures.ReadBytes("glossary.json"), await first.Content.ReadAsByteArrayAsync());
        Assert.Equal(EngineFixtures.ReadBytes("glossary.json"), await second.Content.ReadAsByteArrayAsync());
        Assert.Single(_factory.Engine.CallsTo(EngineStub.Glossary));
    }

    [Fact]
    public async Task Glossary_is_served_when_an_entity_carries_no_plural_label()
    {
        // Only a sorted list reads the labels: a glossary without one is still the glossary.
        var glossary = JsonNode.Parse(EngineFixtures.Read("glossary.json"))!;
        glossary["entities"]![0]!.AsObject().Remove("label");
        var body = glossary.ToJsonString();
        _factory.Engine.Answer(EngineStub.Glossary, HttpStatusCode.OK, body);
        var client = _factory.CreateClient();

        var response = await client.GetAsync(Path);
        var sorted = await client.GetAsync("/api/v1/controls?sort=rootEntity&pageSize=1");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(body, await response.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.OK, sorted.StatusCode);
    }

    [Fact]
    public async Task Glossary_is_fetched_again_when_the_cached_copy_is_older_than_ten_minutes()
    {
        var client = _factory.CreateClient();
        await client.GetAsync(Path);

        _factory.Clock.Advance(TimeSpan.FromMinutes(9));
        await client.GetAsync(Path);
        var callsWhileFresh = _factory.Engine.CallsTo(EngineStub.Glossary).Count;
        _factory.Clock.Advance(TimeSpan.FromMinutes(2));
        await client.GetAsync(Path);

        Assert.Equal(1, callsWhileFresh);
        Assert.Equal(2, _factory.Engine.CallsTo(EngineStub.Glossary).Count);
    }

    [Fact]
    public async Task Glossary_is_served_stale_when_the_engine_is_down_at_refresh_time()
    {
        var client = _factory.CreateClient();
        await client.GetAsync(Path);
        _factory.Clock.Advance(TimeSpan.FromMinutes(11));
        _factory.Engine.Refuse(EngineStub.Glossary);

        var response = await client.GetAsync(Path);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(EngineFixtures.ReadBytes("glossary.json"), await response.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task Glossary_leaves_the_engine_alone_for_half_a_minute_when_a_refresh_has_just_failed()
    {
        var client = _factory.CreateClient();
        await client.GetAsync(Path);
        _factory.Clock.Advance(TimeSpan.FromMinutes(11));
        _factory.Engine.Refuse(EngineStub.Glossary);

        await client.GetAsync(Path);
        var callsAfterTheFailedRefresh = _factory.Engine.CallsTo(EngineStub.Glossary).Count;
        var servedStaleAgain = await client.GetAsync(Path);
        var callsWhileBackingOff = _factory.Engine.CallsTo(EngineStub.Glossary).Count;
        _factory.Clock.Advance(TimeSpan.FromSeconds(31));
        await client.GetAsync(Path);

        // One fetch, then a refresh that was refused twice (the one retry); nothing while backing off; then two more.
        Assert.Equal(3, callsAfterTheFailedRefresh);
        Assert.Equal(HttpStatusCode.OK, servedStaleAgain.StatusCode);
        Assert.Equal(3, callsWhileBackingOff);
        Assert.Equal(5, _factory.Engine.CallsTo(EngineStub.Glossary).Count);
    }

    [Fact]
    public async Task Glossary_returns_503_engine_unavailable_when_it_was_never_fetched_and_the_engine_is_down()
    {
        _factory.Engine.Refuse(EngineStub.Glossary);
        var client = _factory.CreateClient();

        var response = await client.GetAsync(Path);
        var callsAfterTheFirstRead = _factory.Engine.CallsTo(EngineStub.Glossary).Count;
        var again = await client.GetAsync(Path);

        await HttpAssert.ProblemAsync(response, HttpStatusCode.ServiceUnavailable, "ENGINE_UNAVAILABLE");
        await HttpAssert.ProblemAsync(again, HttpStatusCode.ServiceUnavailable, "ENGINE_UNAVAILABLE");
        Assert.Equal(2, callsAfterTheFirstRead);
        Assert.Equal(2, _factory.Engine.CallsTo(EngineStub.Glossary).Count);
    }

    [Fact]
    public async Task Glossary_is_fetched_as_soon_as_the_engine_is_back_when_the_back_off_has_passed()
    {
        _factory.Engine.Refuse(EngineStub.Glossary);
        var client = _factory.CreateClient();
        await client.GetAsync(Path);
        _factory.Engine.Reset();

        var whileBackingOff = await client.GetAsync(Path);
        _factory.Clock.Advance(TimeSpan.FromSeconds(31));
        var afterBackOff = await client.GetAsync(Path);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, whileBackingOff.StatusCode);
        Assert.Equal(HttpStatusCode.OK, afterBackOff.StatusCode);
    }

    [Fact]
    public async Task Glossary_returns_500_internal_error_when_the_engine_body_is_not_a_glossary()
    {
        _factory.Engine.Answer(EngineStub.Glossary, HttpStatusCode.OK, """{"glossaryVersion":"1.0.0"}""");

        var response = await _factory.CreateClient().GetAsync(Path);

        await HttpAssert.ProblemAsync(response, HttpStatusCode.InternalServerError, "INTERNAL_ERROR");
    }
}
