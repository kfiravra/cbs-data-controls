using DataControls.Api.Tests.Support;

namespace DataControls.Api.Tests.Hosting;

[Collection(ApiCollection.Name)]
public sealed class RequestLanguageTests(ApiFixture fixture)
{
    [Theory]
    [InlineData("he")]
    [InlineData("en-US,en;q=0.9")]
    public async Task Request_language_is_hebrew_whatever_is_asked_while_hebrew_is_the_only_language(string header)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/_probe/context");
        request.Headers.TryAddWithoutValidation("Accept-Language", header);

        var response = await fixture.CreateClient().SendAsync(request);

        Assert.Equal("he", (await response.ReadJsonAsync()).GetProperty("language").GetString());
    }
}
