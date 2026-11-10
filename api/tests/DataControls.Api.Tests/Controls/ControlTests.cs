using System.Net;
using System.Text.Json;
using DataControls.Api.Tests.Support;

namespace DataControls.Api.Tests.Controls;

/// <summary>Create, read, archive and versions of a control, through HTTP against the shared database.</summary>
[Collection(ApiCollection.Name)]
public sealed class ControlTests(ApiFixture fixture)
{
    private const string Timestamp = @"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$";
    private const int NoSuchId = int.MaxValue;

    private readonly HttpClient _client = fixture.CreateClient();
    private readonly EngineStub _engine = fixture.Factory.Engine;
    private readonly string _testId = TestData.NewTestId();

    [Fact]
    public async Task Create_returns_201_with_location_and_version_1_when_the_definition_is_valid()
    {
        var name = TestData.Name(_testId);
        var definition = Examples.Definition(Examples.First);

        var response = await _client.PostAsync(ControlRequests.Path, ControlRequests.Save(name, definition));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var control = await response.ReadJsonAsync();
        var id = control.GetProperty("id").GetInt32();
        Assert.Equal(ControlRequests.PathOf(id), response.Headers.Location?.OriginalString);
        Assert.Equal(name, control.GetProperty("name").GetString());
        Assert.Equal(JsonValueKind.Null, control.GetProperty("description").ValueKind);
        Assert.Equal("employee", control.GetProperty("rootEntity").GetString());
        Assert.Equal(1, control.GetProperty("version").GetInt32());
        Assert.True(control.GetProperty("isActive").GetBoolean());
        Assert.Matches(Timestamp, control.GetProperty("createdAt").GetString());
        Assert.Equal(control.GetProperty("createdAt").GetString(), control.GetProperty("updatedAt").GetString());
        Assert.Equal(8, Convert.FromBase64String(control.GetProperty("concurrencyToken").GetString()!).Length);
        HttpAssert.JsonEqual(definition, control.GetProperty("definition").GetRawText());
        Assert.Equal(10, control.EnumerateObject().Count());
        Assert.Single(_engine.CallsTo(EngineStub.Validate));
    }

    [Fact]
    public async Task Get_returns_the_control_as_created_when_it_is_read_back()
    {
        var created = await ControlRequests.CreateAsync(_client, TestData.Name(_testId), description: "  why this control exists  ");

        var response = await _client.GetAsync(ControlRequests.PathOf(created.GetProperty("id").GetInt32()));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var read = await response.ReadJsonAsync();
        HttpAssert.JsonEqual(created.GetRawText(), read.GetRawText());
        Assert.Equal("why this control exists", read.GetProperty("description").GetString());
    }

    [Fact]
    public async Task Create_keeps_a_hebrew_name_intact_and_search_finds_it_when_the_name_is_hebrew()
    {
        var name = TestData.Name(_testId, TestData.HebrewText);

        var created = await ControlRequests.CreateAsync(_client, name);
        var raw = await _client.GetStringAsync(ControlRequests.PathOf(created.GetProperty("id").GetInt32()));
        var found = await ControlRequests.ListAsync(_client, $"{_testId}-{TestData.HebrewText}");

        Assert.Equal(name, created.GetProperty("name").GetString());
        Assert.Contains(TestData.HebrewText, raw);
        Assert.Equal(1, found.GetProperty("total").GetInt32());
        Assert.Equal(name, found.GetProperty("items")[0].GetProperty("name").GetString());
    }

    [Theory]
    [InlineData("   ", null)]
    [InlineData("", null)]
    [InlineData("  kept  ", "kept")]
    public async Task Create_stores_the_description_trimmed_and_an_empty_one_as_null(string description, string? expected)
    {
        var created = await ControlRequests.CreateAsync(_client, TestData.Name(_testId), description: description);

        Assert.Equal(expected, created.GetProperty("description").GetString());
    }

    [Fact]
    public async Task Create_returns_400_listing_every_fault_when_name_description_and_definition_are_all_wrong()
    {
        var body = ControlRequests.Save(new string('n', 201), null, description: new string('d', 1001));

        var response = await _client.PostAsync(ControlRequests.Path, body);

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.BadRequest, "REQUEST_INVALID");
        HttpAssert.JsonEqual(
            """[{"path":"/name","code":"TOO_LONG","params":{"max":200}},{"path":"/description","code":"TOO_LONG","params":{"max":1000}},{"path":"/definition","code":"REQUIRED","params":{}}]""",
            HttpAssert.Errors(problem));
        Assert.Empty(_engine.Calls);
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("")]
    public async Task Create_returns_400_required_for_name_and_definition_when_the_body_is_empty(string body)
    {
        var response = await _client.PostAsync(ControlRequests.Path, Body.Json(body));

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.BadRequest, "REQUEST_INVALID");
        HttpAssert.JsonEqual(
            """[{"path":"/name","code":"REQUIRED","params":{}},{"path":"/definition","code":"REQUIRED","params":{}}]""",
            HttpAssert.Errors(problem));
    }

    [Fact]
    public async Task Create_accepts_a_name_of_exactly_200_characters()
    {
        var name = TestData.Name(_testId, string.Empty).PadRight(200, 'x');

        var created = await ControlRequests.CreateAsync(_client, name);

        Assert.Equal(200, created.GetProperty("name").GetString()!.Length);
    }

    [Fact]
    public async Task Create_returns_422_and_stores_nothing_without_an_engine_call_when_the_schema_fails()
    {
        var invalid = Examples.Invalid("condition-without-operator");

        var response = await _client.PostAsync(
            ControlRequests.Path,
            ControlRequests.Save(TestData.Name(_testId), invalid.GetProperty("definition").GetRawText()));

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.UnprocessableEntity, "DEFINITION_INVALID");
        Assert.Equal(invalid.GetProperty("expected").GetProperty("path").GetString(), problem.GetProperty("errors")[0].GetProperty("path").GetString());
        Assert.Empty(_engine.Calls);
        Assert.Equal(0, (await ControlRequests.ListAsync(_client, _testId, "&active=all")).GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task Create_relays_422_and_stores_nothing_when_the_engine_rejects_the_definition()
    {
        var engineProblem = EngineFixtures.Read("problem-definition-invalid.json");
        _engine.Answer(EngineStub.Validate, HttpStatusCode.UnprocessableEntity, engineProblem);

        var response = await _client.PostAsync(
            ControlRequests.Path,
            ControlRequests.Save(TestData.Name(_testId), Examples.Invalid("unknown-field").GetProperty("definition").GetRawText()));

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.UnprocessableEntity, "DEFINITION_INVALID");
        using var expected = JsonDocument.Parse(engineProblem);
        HttpAssert.JsonEqual(expected.RootElement.GetProperty("errors").GetRawText(), HttpAssert.Errors(problem));
        Assert.Equal(0, (await ControlRequests.ListAsync(_client, _testId, "&active=all")).GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task Create_returns_503_engine_unavailable_and_stores_nothing_when_the_engine_is_down()
    {
        _engine.RefuseEverything();

        var response = await _client.PostAsync(ControlRequests.Path, ControlRequests.Save(TestData.Name(_testId), Examples.Definition(Examples.First)));

        await HttpAssert.ProblemAsync(response, HttpStatusCode.ServiceUnavailable, "ENGINE_UNAVAILABLE");
        Assert.Equal(0, (await ControlRequests.ListAsync(_client, _testId, "&active=all")).GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task Get_returns_404_control_not_found_with_the_id_when_no_control_has_it()
    {
        var response = await _client.GetAsync(ControlRequests.PathOf(NoSuchId));

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.NotFound, "CONTROL_NOT_FOUND");
        HttpAssert.JsonEqual($$"""{"id":{{NoSuchId}} }""", problem.GetProperty("params").GetRawText());
    }

    [Theory]
    [InlineData("abc")]
    [InlineData("0")]
    [InlineData("-1")]
    [InlineData("1.5")]
    [InlineData("99999999999")]
    public async Task Get_returns_404_not_found_when_the_id_segment_is_not_a_positive_integer(string segment)
    {
        var response = await _client.GetAsync($"{ControlRequests.Path}/{segment}");

        await HttpAssert.ProblemAsync(response, HttpStatusCode.NotFound, "NOT_FOUND");
    }

    [Fact]
    public async Task Archive_returns_204_twice_and_the_control_stays_readable_as_inactive()
    {
        var created = await ControlRequests.CreateAsync(_client, TestData.Name(_testId));
        var path = ControlRequests.PathOf(created.GetProperty("id").GetInt32());

        var first = await _client.DeleteAsync(path);
        var afterFirst = await (await _client.GetAsync(path)).ReadJsonAsync();
        var second = await _client.DeleteAsync(path);
        var afterSecond = await (await _client.GetAsync(path)).ReadJsonAsync();

        Assert.Equal(HttpStatusCode.NoContent, first.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, second.StatusCode);
        Assert.False(afterFirst.GetProperty("isActive").GetBoolean());
        HttpAssert.JsonEqual(afterFirst.GetRawText(), afterSecond.GetRawText());
        Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync($"{path}/versions/1")).StatusCode);
    }

    [Fact]
    public async Task Archive_returns_404_control_not_found_when_no_control_has_the_id()
    {
        var response = await _client.DeleteAsync(ControlRequests.PathOf(NoSuchId));

        await HttpAssert.ProblemAsync(response, HttpStatusCode.NotFound, "CONTROL_NOT_FOUND");
    }

    [Fact]
    public async Task Versions_return_404_naming_what_is_missing_when_the_control_or_the_version_does_not_exist()
    {
        var created = await ControlRequests.CreateAsync(_client, TestData.Name(_testId));
        var id = created.GetProperty("id").GetInt32();

        var noControlList = await _client.GetAsync($"{ControlRequests.PathOf(NoSuchId)}/versions");
        var noControl = await _client.GetAsync($"{ControlRequests.PathOf(NoSuchId)}/versions/1");
        var noVersion = await _client.GetAsync($"{ControlRequests.PathOf(id)}/versions/2");

        await HttpAssert.ProblemAsync(noControlList, HttpStatusCode.NotFound, "CONTROL_NOT_FOUND");
        await HttpAssert.ProblemAsync(noControl, HttpStatusCode.NotFound, "CONTROL_NOT_FOUND");
        var problem = await HttpAssert.ProblemAsync(noVersion, HttpStatusCode.NotFound, "VERSION_NOT_FOUND");
        HttpAssert.JsonEqual($$"""{"id":{{id}},"version":2}""", problem.GetProperty("params").GetRawText());
    }

    [Fact]
    public async Task Version_returns_its_definition_and_the_list_its_hash_when_the_control_has_one_version()
    {
        var definition = Examples.Definition(Examples.First);
        var created = await ControlRequests.CreateAsync(_client, TestData.Name(_testId), definition);
        var path = ControlRequests.PathOf(created.GetProperty("id").GetInt32());

        var list = await (await _client.GetAsync($"{path}/versions")).ReadJsonAsync();
        var one = await (await _client.GetAsync($"{path}/versions/1")).ReadJsonAsync();

        var summary = Assert.Single(list.EnumerateArray());
        Assert.Equal(1, summary.GetProperty("version").GetInt32());
        Assert.Matches("^[0-9a-f]{64}$", summary.GetProperty("definitionHash").GetString());
        Assert.Equal(created.GetProperty("createdAt").GetString(), summary.GetProperty("createdAt").GetString());
        Assert.Equal(3, summary.EnumerateObject().Count());
        Assert.Equal(1, one.GetProperty("version").GetInt32());
        HttpAssert.JsonEqual(definition, one.GetProperty("definition").GetRawText());
        Assert.Equal(3, one.EnumerateObject().Count());
    }
}
