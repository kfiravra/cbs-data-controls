namespace DataControls.Api.Hosting;

internal static class LanguageRule
{
    /// <summary>
    /// The contract's rule, as the engine applies it: the primary subtag of the first range of
    /// <c>Accept-Language</c> when it is a listed language; anything else, or no header, is the default.
    /// </summary>
    public static string Resolve(string? acceptLanguage, IReadOnlyCollection<string> languages, string defaultLanguage)
    {
        if (string.IsNullOrWhiteSpace(acceptLanguage))
        {
            return defaultLanguage;
        }

        var firstRange = acceptLanguage.Split(',', 2)[0];
        var tag = firstRange.Split(';', 2)[0].Trim();
        var primary = tag.Split('-', 2)[0];
        return languages.FirstOrDefault(language => string.Equals(language, primary, StringComparison.OrdinalIgnoreCase))
            ?? defaultLanguage;
    }
}
