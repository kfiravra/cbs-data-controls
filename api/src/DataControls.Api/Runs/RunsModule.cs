using System.Text.RegularExpressions;

namespace DataControls.Api.Runs;

internal static partial class RunsModule
{
    private const int MaxRowCap = 100_000;

    public static IServiceCollection AddRuns(this IServiceCollection services)
    {
        services.AddOptions<RunsOptions>()
            .BindConfiguration(RunsOptions.Section)
            .Validate(options => options.RowCap is >= 1 and <= MaxRowCap, $"Runs:RowCap must be between 1 and {MaxRowCap}.")
            .Validate(
                options => RunTimeZone.TryResolve(options.TimeZone, out _),
                "Runs:TimeZone does not name a time zone this machine knows (an IANA id such as Asia/Jerusalem, or a Windows id).")
            .Validate(
                options => LanguageTag().IsMatch(options.DefaultLanguage),
                "Runs:DefaultLanguage must be a language tag of two or three lower-case letters, such as he.")
            .ValidateOnStart();
        return services;
    }

    [GeneratedRegex(@"\A[a-z]{2,3}\z")]
    private static partial Regex LanguageTag();
}
