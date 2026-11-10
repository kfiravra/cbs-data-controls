using System.Net;
using DataControls.Api.Tests.Support;

namespace DataControls.Api.Tests.Health;

[Collection(ApiCollection.Name)]
public sealed class HealthTests(ApiFixture fixture)
{
    [Fact]
    public async Task Health_returns_200_and_reports_the_database_ok_when_sql_server_answers()
    {
        var response = await fixture.Factory.CreateClient().GetAsync("/api/v1/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var health = await response.ReadJsonAsync();
        Assert.Equal("ok", health.GetProperty("database").GetString());
        Assert.Equal("1.0.0", health.GetProperty("version").GetString());
        var expectedStatus = health.GetProperty("engine").GetString() == "ok" ? "ok" : "degraded";
        Assert.Equal(expectedStatus, health.GetProperty("status").GetString());
    }
}
