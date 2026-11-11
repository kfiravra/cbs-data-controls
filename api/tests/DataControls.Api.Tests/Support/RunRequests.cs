using System.Net;
using System.Text.Json;

namespace DataControls.Api.Tests.Support;

internal static class RunRequests
{
    public static string RunsOf(int controlId) => $"{ControlRequests.PathOf(controlId)}/runs";

    public static string PathOf(int runId) => $"/api/v1/runs/{runId}";

    /// <summary>Starts a run with an optional body and returns the run, which must have been created.</summary>
    public static async Task<JsonElement> StartAsync(HttpClient client, int controlId, string? body = null)
    {
        var response = await client.PostAsync(RunsOf(controlId), body is null ? null : Body.Json(body));
        Assert.True(response.StatusCode == HttpStatusCode.Created, await response.Content.ReadAsStringAsync());
        return await response.ReadJsonAsync();
    }

    public static async Task<JsonElement> ResultsAsync(HttpClient client, int runId, string query = "")
    {
        var response = await client.GetAsync($"{PathOf(runId)}/results{query}");
        Assert.True(response.StatusCode == HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        return await response.ReadJsonAsync();
    }

    /// <summary>
    /// Each violation as its key and its matched ids, from a list of result items or from an example's
    /// <c>expected.violations</c>, so the two can be compared whatever their layout.
    /// </summary>
    public static IEnumerable<(string? Key, string Matched)> KeysAndMatched(JsonElement violations) =>
        violations.EnumerateArray().Select(violation => (
            violation.GetProperty("key").GetString(),
            string.Join(",", violation.GetProperty("matched").EnumerateArray().Select(id => id.GetString()))));

    public static IEnumerable<string> Keys(JsonElement page) =>
        page.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("key").GetString()!);
}
