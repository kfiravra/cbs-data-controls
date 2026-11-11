using System.Net;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace DataControls.Api.Tests.Support;

/// <summary>Builds and sends the save requests of a control, so a test states only what it is about.</summary>
internal static class ControlRequests
{
    public const string Path = "/api/v1/controls";

    public static string PathOf(int id) => $"{Path}/{id}";

    /// <summary>A save body. A member left null is not sent.</summary>
    public static StringContent Save(string? name, string? definitionJson, string? description = null, string? concurrencyToken = null)
    {
        var body = new JsonObject();
        if (name is not null)
        {
            body["name"] = name;
        }

        if (description is not null)
        {
            body["description"] = description;
        }

        if (definitionJson is not null)
        {
            body["definition"] = JsonNode.Parse(definitionJson);
        }

        if (concurrencyToken is not null)
        {
            body["concurrencyToken"] = concurrencyToken;
        }

        return Body.Json(body.ToJsonString());
    }

    /// <summary>Creates a control with the first example's definition unless another is given, and returns it.</summary>
    public static async Task<JsonElement> CreateAsync(HttpClient client, string name, string? definitionJson = null, string? description = null)
    {
        var response = await client.PostAsync(Path, Save(name, definitionJson ?? Examples.Definition(Examples.First), description));
        Assert.True(response.StatusCode == HttpStatusCode.Created, await response.Content.ReadAsStringAsync());
        return await response.ReadJsonAsync();
    }

    public static Task<HttpResponseMessage> UpdateAsync(HttpClient client, JsonElement control, string? name = null, string? definitionJson = null, string? description = null, string? concurrencyToken = null) =>
        client.PutAsync(
            PathOf(control.GetProperty("id").GetInt32()),
            Save(
                name ?? control.GetProperty("name").GetString(),
                definitionJson ?? control.GetProperty("definition").GetRawText(),
                description,
                concurrencyToken ?? control.GetProperty("concurrencyToken").GetString()));

    /// <summary>The controls list, narrowed to one test's controls by its id.</summary>
    public static async Task<JsonElement> ListAsync(HttpClient client, string testId, string query = "")
    {
        var response = await client.GetAsync($"{Path}?search={Uri.EscapeDataString(testId)}{query}");
        Assert.True(response.StatusCode == HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        return await response.ReadJsonAsync();
    }
}
