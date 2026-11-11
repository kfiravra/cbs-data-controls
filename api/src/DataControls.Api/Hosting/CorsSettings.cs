namespace DataControls.Api.Hosting;

/// <summary>The origins allowed to call the api from a browser. Empty by default: <c>ng serve</c> proxies <c>/api</c>.</summary>
public sealed class CorsSettings
{
    public const string Section = "Cors";

    public string[] AllowedOrigins { get; set; } = [];

    /// <summary>An origin is a scheme, a host and an optional port; a wildcard is never one.</summary>
    internal static bool IsOrigin(string value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri)
        && uri.Scheme is "http" or "https"
        && string.Equals(uri.GetLeftPart(UriPartial.Authority), value, StringComparison.OrdinalIgnoreCase);
}
