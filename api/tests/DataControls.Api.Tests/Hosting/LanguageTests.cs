using DataControls.Api.Hosting;
using DataControls.Api.Tests.Support;

namespace DataControls.Api.Tests.Hosting;

public sealed class LanguageRuleTests
{
    private static readonly string[] _languages = ["he", "en"];

    [Theory]
    [InlineData(null, "he")]
    [InlineData("", "he")]
    [InlineData("en", "en")]
    [InlineData("en-US,he;q=0.9", "en")]
    [InlineData("EN-us", "en")]
    [InlineData("he-IL;q=0.8, en", "he")]
    [InlineData("fr,en;q=0.9", "he")]
    [InlineData("*", "he")]
    public void Language_is_the_primary_subtag_of_the_first_range_when_listed_and_the_default_otherwise(string? header, string expected)
    {
        Assert.Equal(expected, LanguageRule.Resolve(header, _languages, "he"));
    }
}

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

        var response = await fixture.Factory.CreateClient().SendAsync(request);

        Assert.Equal("he", (await response.ReadJsonAsync()).GetProperty("language").GetString());
    }
}
