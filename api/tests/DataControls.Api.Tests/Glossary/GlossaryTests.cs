using System.Net;
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
    public async Task Glossary_returns_503_engine_unavailable_when_it_was_never_fetched_and_the_engine_is_down()
    {
        _factory.Engine.Refuse(EngineStub.Glossary);

        var response = await _factory.CreateClient().GetAsync(Path);

        await HttpAssert.ProblemAsync(response, HttpStatusCode.ServiceUnavailable, "ENGINE_UNAVAILABLE");
    }

    [Fact]
    public async Task Glossary_returns_500_internal_error_when_the_engine_body_is_not_a_glossary()
    {
        _factory.Engine.Answer(EngineStub.Glossary, HttpStatusCode.OK, """{"glossaryVersion":"1.0.0"}""");

        var response = await _factory.CreateClient().GetAsync(Path);

        await HttpAssert.ProblemAsync(response, HttpStatusCode.InternalServerError, "INTERNAL_ERROR");
    }
}
