using System.Net;
using DataControls.Api.Tests.Support;

namespace DataControls.Api.Tests.Hosting;

/// <summary>The api also serves the client's build: its files, and its page for every client route.</summary>
[Collection(ApiCollection.Name)]
public sealed class StaticHostingTests(ApiFixture fixture)
{
    private readonly HttpClient _client = fixture.CreateClient();

    [Theory]
    [InlineData("/")]
    [InlineData("/controls")]
    [InlineData("/runs/1")]
    [InlineData("/index.html")]
    public async Task Client_route_returns_the_index_page_uncached(string path)
    {
        var response = await _client.GetAsync(path);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/html", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal(ApiFactory.IndexPage, await response.Content.ReadAsStringAsync());
        Assert.Equal("no-cache", response.Headers.CacheControl?.ToString());
    }

    [Fact]
    public async Task Client_file_is_served_as_it_is_when_the_build_has_it()
    {
        var response = await _client.GetAsync($"/{ApiFactory.ScriptName}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(ApiFactory.ScriptText, await response.Content.ReadAsStringAsync());
        Assert.Null(response.Headers.CacheControl);
    }

    [Theory]
    [InlineData("/missing.js")]
    [InlineData("/assets/logo.png")]
    public async Task File_path_returns_a_404_problem_and_not_the_page_when_no_such_file_exists(string path)
    {
        var response = await _client.GetAsync(path);

        await HttpAssert.ProblemAsync(response, HttpStatusCode.NotFound, "NOT_FOUND");
    }

    [Theory]
    [InlineData("/api")]
    [InlineData("/api/v2/controls")]
    [InlineData("/api/v1/controls/1/unknown")]
    public async Task Api_path_returns_a_404_problem_and_not_the_page_when_nothing_serves_it(string path)
    {
        var response = await _client.GetAsync(path);

        await HttpAssert.ProblemAsync(response, HttpStatusCode.NotFound, "NOT_FOUND");
    }
}
