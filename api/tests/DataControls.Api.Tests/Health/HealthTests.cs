using System.Net;
using DataControls.Api.Tests.Support;

namespace DataControls.Api.Tests.Health;

[Collection(ApiCollection.Name)]
public sealed class HealthTests(ApiFixture fixture)
{
    [Fact]
    public async Task Health_returns_200_degraded_with_the_database_ok_when_the_engine_is_not_probed_yet()
    {
        var response = await fixture.Factory.CreateClient().GetAsync("/api/v1/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        HttpAssert.JsonEqual(
            """{"status":"degraded","database":"ok","engine":"unavailable","version":"1.0.0"}""",
            await response.Content.ReadAsStringAsync());
    }
}
