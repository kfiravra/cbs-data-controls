using System.Net;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace DataControls.Api.Tests.Support;

internal static class HttpAssert
{
    public const string ProblemContentType = "application/problem+json";

    public static void JsonEqual(string expected, string actual) =>
        Assert.True(
            JsonNode.DeepEquals(JsonNode.Parse(expected), JsonNode.Parse(actual)),
            $"Expected JSON:\n{expected}\nActual JSON:\n{actual}");

    public static async Task<JsonElement> ReadJsonAsync(this HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.Clone();
    }

    /// <summary>Checks the status, the media type and the code, and returns the problem.</summary>
    public static async Task<JsonElement> ProblemAsync(HttpResponseMessage response, HttpStatusCode status, string code)
    {
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(status == response.StatusCode, $"Expected {(int)status}, got {(int)response.StatusCode}: {body}");
        Assert.Equal(ProblemContentType, response.Content.Headers.ContentType?.MediaType);
        using var document = JsonDocument.Parse(body);
        var problem = document.RootElement.Clone();
        Assert.Equal(code, problem.GetProperty("code").GetString());
        Assert.Equal(code, problem.GetProperty("title").GetString());
        Assert.Equal((int)status, problem.GetProperty("status").GetInt32());
        Assert.Equal("about:blank", problem.GetProperty("type").GetString());
        return problem;
    }

    /// <summary>The <c>errors</c> of a problem as compact JSON, to compare with an expected literal.</summary>
    public static string Errors(JsonElement problem) => problem.GetProperty("errors").GetRawText();
}
