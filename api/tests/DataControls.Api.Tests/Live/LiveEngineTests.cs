using System.Net;
using System.Text.Json;
using DataControls.Api.Tests.Support;

namespace DataControls.Api.Tests.Live;

/// <summary>
/// The api against the real engine and the seeded database: the examples of <c>contracts/examples/</c>
/// must flag exactly the records their files expect. Skipped unless <c>DC_LIVE=1</c>.
/// </summary>
[Collection(ApiCollection.Name)]
[Trait("Category", "Live")]
public sealed class LiveEngineTests : IAsyncLifetime
{
    private readonly LiveApiFactory _factory = new();
    private readonly string _testId = TestData.NewTestId();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    [LiveFact]
    public async Task Glossary_is_served_from_the_engine()
    {
        var response = await _factory.CreateClient().GetAsync("/api/v1/glossary");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("he", (await response.ReadJsonAsync()).GetProperty("defaultLanguage").GetString());
    }

    [LiveFact]
    public async Task Every_example_flags_the_expected_records_on_its_run_date_and_on_its_alternate_dates()
    {
        var client = _factory.CreateClient();
        foreach (var exampleId in Examples.AllIds)
        {
            var example = Examples.Example(exampleId);
            var control = await ControlRequests.CreateAsync(client, TestData.Name(_testId, exampleId), Examples.Definition(exampleId));
            var controlId = control.GetProperty("id").GetInt32();

            await AssertRunAsync(client, controlId, exampleId, example.GetProperty("runDate").GetString()!, example.GetProperty("expected"));
            if (example.TryGetProperty("alternateRuns", out var alternates))
            {
                foreach (var alternate in alternates.EnumerateArray())
                {
                    await AssertRunAsync(client, controlId, exampleId, alternate.GetProperty("runDate").GetString()!, alternate.GetProperty("expected"));
                }
            }
        }
    }

    [LiveFact]
    public async Task Every_semantic_fixture_is_rejected_by_the_engine_with_its_code_and_path()
    {
        var client = _factory.CreateClient();
        foreach (var fixtureName in Examples.InvalidNamesOf("semantic"))
        {
            var invalid = Examples.Invalid(fixtureName);
            var expected = invalid.GetProperty("expected");

            var response = await client.PostAsync("/api/v1/controls/validate", Body.Definition(invalid.GetProperty("definition").GetRawText()));

            var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.UnprocessableEntity, "DEFINITION_INVALID");
            Assert.Contains(
                problem.GetProperty("errors").EnumerateArray(),
                error => error.GetProperty("code").GetString() == expected.GetProperty("code").GetString()
                    && error.GetProperty("path").GetString() == expected.GetProperty("path").GetString());
        }
    }

    private static async Task AssertRunAsync(HttpClient client, int controlId, string exampleId, string runDate, JsonElement expected)
    {
        var run = await RunRequests.StartAsync(client, controlId, $$"""{"runDate":"{{runDate}}"}""");
        Assert.True(run.GetProperty("status").GetString() == "succeeded", $"{exampleId} on {runDate}: {run.GetRawText()}");
        Assert.Equal(expected.GetProperty("total").GetInt32(), run.GetProperty("totalCount").GetInt32());

        var rows = new List<(string? Key, string Matched)>();
        for (var page = 1; ; page++)
        {
            var results = await RunRequests.ResultsAsync(client, run.GetProperty("id").GetInt32(), $"?page={page}&pageSize=200");
            var items = RunRequests.KeysAndMatched(results.GetProperty("items")).ToList();
            rows.AddRange(items);
            if (items.Count == 0)
            {
                break;
            }
        }

        Assert.Equal(RunRequests.KeysAndMatched(expected.GetProperty("violations")), rows);
    }
}
