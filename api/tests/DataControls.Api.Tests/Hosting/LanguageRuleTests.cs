using DataControls.Api.Hosting;

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
    public void Language_is_the_first_range_primary_subtag_when_listed_and_the_default_when_not(string? header, string expected)
    {
        Assert.Equal(expected, LanguageRule.Resolve(header, _languages, "he"));
    }
}
