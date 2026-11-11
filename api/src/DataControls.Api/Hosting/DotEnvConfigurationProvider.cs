using DataControls.Api.Persistence;

namespace DataControls.Api.Hosting;

/// <summary>
/// Reads the repository's <c>.env</c> in Development, so the api started from a checkout uses the same
/// database block as compose and the scripts. <c>KEY=value</c> lines; <c>__</c> in a key is a section break.
/// The file also holds the administrator's password and the engine's: only the api's own keys are taken.
/// </summary>
internal sealed class DotEnvConfigurationProvider(string startDirectory) : ConfigurationProvider
{
    private const string FileName = ".env";
    private const string SectionBreak = "__";

    public override void Load()
    {
        var file = FindUpwards(startDirectory);
        if (file is null)
        {
            return;
        }

        foreach (var line in File.ReadLines(file))
        {
            var trimmed = line.Trim();
            var separator = trimmed.IndexOf('=');
            if (trimmed.StartsWith('#') || separator <= 0)
            {
                continue;
            }

            var key = trimmed[..separator].Trim();
            if (IsApiKey(key))
            {
                Data[key.Replace(SectionBreak, ConfigurationPath.KeyDelimiter)] = trimmed[(separator + 1)..].Trim();
            }
        }
    }

    /// <summary>The three database keys the api reads, and its own settings, which are all <c>Section__Key</c>.</summary>
    private static bool IsApiKey(string key) =>
        key is DatabaseOptions.HostKey or DatabaseOptions.PortKey or DatabaseOptions.PasswordKey
        || key.Contains(SectionBreak, StringComparison.Ordinal);

    private static string? FindUpwards(string directory)
    {
        for (var current = new DirectoryInfo(directory); current is not null; current = current.Parent)
        {
            var candidate = Path.Combine(current.FullName, FileName);
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }

        return null;
    }
}
