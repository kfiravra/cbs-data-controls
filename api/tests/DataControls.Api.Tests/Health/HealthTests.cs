using System.Diagnostics;
using System.Net;
using DataControls.Api.Tests.Support;

namespace DataControls.Api.Tests.Health;

[Collection(ApiCollection.Name)]
public sealed class HealthTests(ApiFixture fixture)
{
    private const string Path = "/api/v1/health";

    private readonly HttpClient _client = fixture.CreateClient();

    [Fact]
    public async Task Health_returns_200_ok_when_the_database_and_the_engine_answer()
    {
        var response = await _client.GetAsync(Path);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        HttpAssert.JsonEqual(
            """{"status":"ok","database":"ok","engine":"ok","version":"1.0.0"}""",
            await response.Content.ReadAsStringAsync());
        Assert.Single(fixture.Factory.Engine.CallsTo(EngineStub.Health));
    }

    [Fact]
    public async Task Health_returns_200_degraded_after_one_call_when_the_engine_refuses_the_connection()
    {
        fixture.Factory.Engine.Refuse(EngineStub.Health);

        var response = await _client.GetAsync(Path);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        HttpAssert.JsonEqual(
            """{"status":"degraded","database":"ok","engine":"unavailable","version":"1.0.0"}""",
            await response.Content.ReadAsStringAsync());
        Assert.Single(fixture.Factory.Engine.CallsTo(EngineStub.Health));
    }

    [Fact]
    public async Task Health_returns_200_degraded_after_one_call_when_the_engine_reports_its_own_database_down()
    {
        fixture.Factory.Engine.Answer(EngineStub.Health, HttpStatusCode.ServiceUnavailable, EngineFixtures.Read("problem-database-unavailable.json"));

        var response = await _client.GetAsync(Path);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        HttpAssert.JsonEqual(
            """{"status":"degraded","database":"ok","engine":"unavailable","version":"1.0.0"}""",
            await response.Content.ReadAsStringAsync());
        Assert.Single(fixture.Factory.Engine.CallsTo(EngineStub.Health));
    }

    [Fact]
    public async Task Health_returns_200_degraded_after_two_seconds_when_the_engine_does_not_answer_and_the_attempt_timeout_is_long()
    {
        // On a host of its own: with the shared host's half-second attempt timeout the probe's own limit would never be reached.
        await using var factory = new ApiFactory(new Dictionary<string, string> { ["Engine:AttemptTimeout"] = "00:01:00" });
        factory.Engine.Delay(EngineStub.Health, TimeSpan.FromMinutes(1));
        var client = factory.CreateClient();
        var watch = Stopwatch.StartNew();

        var response = await client.GetAsync(Path);

        watch.Stop();
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        HttpAssert.JsonEqual(
            """{"status":"degraded","database":"ok","engine":"unavailable","version":"1.0.0"}""",
            await response.Content.ReadAsStringAsync());
        Assert.InRange(watch.Elapsed, TimeSpan.FromSeconds(1.5), TimeSpan.FromSeconds(8));
    }
}
