using System.Net;
using DataControls.Api.Tests.Support;

namespace DataControls.Api.Tests.Health;

[Collection(ApiCollection.Name)]
public sealed class HealthTests(ApiFixture fixture)
{
    private readonly HttpClient _client = fixture.CreateClient();

    [Fact]
    public async Task Health_returns_200_ok_when_the_database_and_the_engine_answer()
    {
        var response = await _client.GetAsync("/api/v1/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        HttpAssert.JsonEqual(
            """{"status":"ok","database":"ok","engine":"ok","version":"1.0.0"}""",
            await response.Content.ReadAsStringAsync());
        Assert.Single(fixture.Factory.Engine.CallsTo(EngineStub.Health));
    }

    [Fact]
    public async Task Health_returns_200_degraded_when_the_engine_refuses_the_connection()
    {
        fixture.Factory.Engine.Refuse(EngineStub.Health);

        var response = await _client.GetAsync("/api/v1/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        HttpAssert.JsonEqual(
            """{"status":"degraded","database":"ok","engine":"unavailable","version":"1.0.0"}""",
            await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Health_returns_200_degraded_when_the_engine_reports_its_own_database_down()
    {
        fixture.Factory.Engine.Answer(EngineStub.Health, HttpStatusCode.ServiceUnavailable, EngineFixtures.Read("problem-database-unavailable.json"));

        var response = await _client.GetAsync("/api/v1/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("unavailable", (await response.ReadJsonAsync()).GetProperty("engine").GetString());
    }

    [Fact]
    public async Task Health_returns_200_degraded_within_the_probe_time_when_the_engine_does_not_answer()
    {
        fixture.Factory.Engine.Delay(EngineStub.Health, TimeSpan.FromSeconds(30));

        var response = await _client.GetAsync("/api/v1/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("degraded", (await response.ReadJsonAsync()).GetProperty("status").GetString());
    }
}
