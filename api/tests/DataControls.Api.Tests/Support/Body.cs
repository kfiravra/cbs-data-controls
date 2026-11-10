using System.Net.Http.Headers;
using System.Text;

namespace DataControls.Api.Tests.Support;

internal static class Body
{
    /// <summary>Text sent as <c>application/json</c>, exactly as given.</summary>
    public static StringContent Json(string text)
    {
        var content = new StringContent(text, Encoding.UTF8);
        content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
        return content;
    }

    /// <summary>The body of a request that carries one definition.</summary>
    public static StringContent Definition(string definitionJson) => Json($$"""{"definition":{{definitionJson}}}""");
}
