using System.Net;
using DataControls.Api.Tests.Support;

namespace DataControls.Api.Tests.Hosting;

[Collection(ApiCollection.Name)]
public sealed class CorsTests(ApiFixture fixture)
{
    private const string AllowedOrigin = "http://localhost:4200";
    private const string AllowOriginHeader = "Access-Control-Allow-Origin";

    [Theory]
    [InlineData(AllowedOrigin, true)]
    [InlineData("http://elsewhere.example", false)]
    public async Task Preflight_passes_only_when_the_origin_is_configured(string origin, bool allowed)
    {
        await using var factory = new ApiFactory(new Dictionary<string, string> { ["Cors:AllowedOrigins:0"] = AllowedOrigin });

        var response = await factory.CreateClient().SendAsync(Preflight(origin));

        Assert.Equal(allowed, response.Headers.Contains(AllowOriginHeader));
        if (allowed)
        {
            Assert.Equal(AllowedOrigin, Assert.Single(response.Headers.GetValues(AllowOriginHeader)));
        }
    }

    [Fact]
    public async Task Preflight_passes_for_no_origin_when_none_is_configured()
    {
        var response = await fixture.CreateClient().SendAsync(Preflight(AllowedOrigin));

        Assert.False(response.Headers.Contains(AllowOriginHeader));
    }

    [Fact]
    public async Task Response_to_a_configured_origin_exposes_the_correlation_id_and_the_location()
    {
        await using var factory = new ApiFactory(new Dictionary<string, string> { ["Cors:AllowedOrigins:0"] = AllowedOrigin });
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/health");
        request.Headers.Add("Origin", AllowedOrigin);

        var response = await factory.CreateClient().SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var exposed = string.Join(",", response.Headers.GetValues("Access-Control-Expose-Headers"));
        Assert.Contains("X-Correlation-Id", exposed);
        Assert.Contains("Location", exposed);
    }

    private static HttpRequestMessage Preflight(string origin)
    {
        var request = new HttpRequestMessage(HttpMethod.Options, "/api/v1/controls");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "content-type");
        return request;
    }
}
