using DataControls.Api.Runs;
using Microsoft.Extensions.Options;

namespace DataControls.Api.Hosting;

/// <summary>
/// The languages text can be rendered in. The glossary owns the list; the configured default stands in
/// until the glossary has been read.
/// </summary>
public sealed class SupportedLanguages
{
    private readonly LanguageSet _current;

    public SupportedLanguages(IOptions<RunsOptions> options)
    {
        var fallback = options.Value.DefaultLanguage;
        _current = new LanguageSet([fallback], fallback);
    }

    public string Default => _current.Default;

    public string Resolve(string? acceptLanguage)
    {
        var current = _current;
        return LanguageRule.Resolve(acceptLanguage, current.Languages, current.Default);
    }

    private sealed record LanguageSet(IReadOnlyCollection<string> Languages, string Default);
}
