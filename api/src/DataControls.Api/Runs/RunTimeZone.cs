namespace DataControls.Api.Runs;

internal static class RunTimeZone
{
    public const string DefaultId = "Asia/Jerusalem";

    private const string DefaultWindowsId = "Israel Standard Time";

    /// <summary>
    /// Resolves the configured zone. An IANA id resolves on Linux with tzdata and on Windows through ICU; a
    /// Windows without ICU knows only Windows ids, so the id is converted, and the default has its Windows
    /// name as a last resort.
    /// </summary>
    public static bool TryResolve(string id, out TimeZoneInfo zone)
    {
        if (TimeZoneInfo.TryFindSystemTimeZoneById(id, out var found))
        {
            zone = found;
            return true;
        }

        if (TimeZoneInfo.TryConvertIanaIdToWindowsId(id, out var windowsId)
            && TimeZoneInfo.TryFindSystemTimeZoneById(windowsId, out found))
        {
            zone = found;
            return true;
        }

        if (id == DefaultId && TimeZoneInfo.TryFindSystemTimeZoneById(DefaultWindowsId, out found))
        {
            zone = found;
            return true;
        }

        zone = TimeZoneInfo.Utc;
        return false;
    }
}
