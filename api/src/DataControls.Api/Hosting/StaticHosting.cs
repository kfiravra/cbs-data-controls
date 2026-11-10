using Microsoft.Net.Http.Headers;

namespace DataControls.Api.Hosting;

/// <summary>
/// Serves the client's production build from the <c>wwwroot</c> beside the app, when there is one, so one
/// process answers both the client and the api.
/// </summary>
internal static class StaticHosting
{
    private const string IndexFile = "index.html";

    public static void UseClientFiles(this WebApplication app)
    {
        var files = ClientFileOptions();
        app.UseStaticFiles(files);
        // A path the api does not serve and that is not a file is one of the client's own routes.
        app.MapFallbackToFile(IndexFile, files);
    }

    private static StaticFileOptions ClientFileOptions() => new()
    {
        OnPrepareResponse = context =>
        {
            // The page names its scripts by content hash, so it must be asked for again on every visit.
            if (context.File.Name == IndexFile)
            {
                context.Context.Response.Headers[HeaderNames.CacheControl] = "no-cache";
            }
        },
    };
}
