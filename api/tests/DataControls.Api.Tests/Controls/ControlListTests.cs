using System.Net;
using System.Text.Json;
using System.Text.Json.Nodes;
using DataControls.Api.Tests.Support;

namespace DataControls.Api.Tests.Controls;

/// <summary><c>GET /api/v1/controls</c>. Every list here is narrowed to this test's own controls by its id.</summary>
[Collection(ApiCollection.Name)]
public sealed class ControlListTests(ApiFixture fixture)
{
    private const string DepartmentExample = "department-without-active-employees";

    private readonly HttpClient _client = fixture.CreateClient();
    private readonly EngineStub _engine = fixture.Factory.Engine;
    private readonly TestClock _clock = fixture.Factory.Clock;
    private readonly string _testId = TestData.NewTestId();

    [Fact]
    public async Task List_shows_active_controls_only_unless_active_asks_for_archived_or_all()
    {
        var active = await CreateAsync("active");
        var archived = await CreateAsync("archived");
        await _client.DeleteAsync(ControlRequests.PathOf(Id(archived)));

        var byDefault = await ControlRequests.ListAsync(_client, _testId);
        var activeOnly = await ControlRequests.ListAsync(_client, _testId, "&active=true");
        var archivedOnly = await ControlRequests.ListAsync(_client, _testId, "&active=false");
        var all = await ControlRequests.ListAsync(_client, _testId, "&active=all");

        Assert.Equal([Id(active)], Ids(byDefault));
        Assert.Equal([Id(active)], Ids(activeOnly));
        Assert.Equal([Id(archived)], Ids(archivedOnly));
        Assert.Equal(new[] { Id(active), Id(archived) }.Order(), Ids(all).Order());
    }

    [Fact]
    public async Task List_is_ordered_by_name_and_then_by_id_when_two_controls_share_a_name()
    {
        var b = await CreateAsync("b");
        var firstA = await CreateAsync("a");
        var secondA = await CreateAsync("a");

        var list = await ControlRequests.ListAsync(_client, _testId);

        Assert.Equal([Id(firstA), Id(secondA), Id(b)], Ids(list));
    }

    [Fact]
    public async Task List_is_ordered_by_name_from_the_end_and_still_by_id_when_dir_is_desc()
    {
        var b = await CreateAsync("b");
        var firstA = await CreateAsync("a");
        var secondA = await CreateAsync("a");

        var named = await ControlRequests.ListAsync(_client, _testId, "&sort=name&dir=desc");
        var byDefault = await ControlRequests.ListAsync(_client, _testId, "&dir=desc");

        Assert.Equal([Id(b), Id(firstA), Id(secondA)], Ids(named));
        Assert.Equal(Ids(named), Ids(byDefault));
    }

    [Fact]
    public async Task List_is_ordered_by_the_label_of_the_root_entity_and_not_by_its_key_when_sort_is_rootEntity()
    {
        // The glossary's labels put the three entities in another order than their keys do.
        var byLabel = EntityKeysByLabel();
        Assert.NotEqual(byLabel.Order(StringComparer.Ordinal), byLabel);
        var created = new Dictionary<string, int>();
        foreach (var entity in byLabel.Order(StringComparer.Ordinal))
        {
            created[entity] = Id(await ControlRequests.CreateAsync(_client, TestData.Name(_testId, entity), DefinitionOf(entity)));
        }

        var second = Id(await ControlRequests.CreateAsync(_client, TestData.Name(_testId, "a second one"), DefinitionOf(byLabel[0])));

        var ascending = await ControlRequests.ListAsync(_client, _testId, "&sort=rootEntity");
        var descending = await ControlRequests.ListAsync(_client, _testId, "&sort=rootEntity&dir=desc");

        // Inside one entity the controls stand by name whatever the direction.
        Assert.Equal([second, created[byLabel[0]], created[byLabel[1]], created[byLabel[2]]], Ids(ascending));
        Assert.Equal([created[byLabel[2]], created[byLabel[1]], second, created[byLabel[0]]], Ids(descending));
    }

    [Fact]
    public async Task List_is_ordered_by_the_root_entity_key_when_sort_is_rootEntity_and_no_glossary_can_be_read()
    {
        // The glossary cache lives as long as its host: a host of its own has never read one.
        await using var factory = new ApiFactory();
        factory.Engine.Refuse(EngineStub.Glossary);
        var client = factory.CreateClient();
        var byKey = new List<int>();
        foreach (var entity in EntityKeysByLabel().Order(StringComparer.Ordinal))
        {
            byKey.Add(Id(await ControlRequests.CreateAsync(client, TestData.Name(_testId, entity), DefinitionOf(entity))));
        }

        var ascending = await ControlRequests.ListAsync(client, _testId, "&sort=rootEntity");
        var descending = await ControlRequests.ListAsync(client, _testId, "&sort=rootEntity&dir=desc");

        Assert.Equal(byKey, Ids(ascending));
        Assert.Equal(byKey.AsEnumerable().Reverse(), Ids(descending));
    }

    [Fact]
    public async Task List_is_ordered_by_the_newest_run_with_a_control_that_never_ran_last_when_sort_is_lastRun()
    {
        var neverRan = await CreateAsync("a never ran");
        var ranFirst = await CreateAsync("b ran first");
        var ranLast = await CreateAsync("c ran last");
        _engine.Answer(EngineStub.Run, HttpStatusCode.OK, RunAnswers.Numbered(1));
        await RunRequests.StartAsync(_client, Id(ranFirst));
        _clock.Advance(TimeSpan.FromMinutes(1));
        await RunRequests.StartAsync(_client, Id(ranLast));
        _clock.Advance(TimeSpan.FromMinutes(1));
        // A second run of the first control is still older than what follows it here.
        await RunRequests.StartAsync(_client, Id(ranFirst));
        _clock.Advance(TimeSpan.FromMinutes(1));
        await RunRequests.StartAsync(_client, Id(ranLast));

        var ascending = await ControlRequests.ListAsync(_client, _testId, "&sort=lastRun");
        var descending = await ControlRequests.ListAsync(_client, _testId, "&sort=lastRun&dir=desc");

        Assert.Equal([Id(ranFirst), Id(ranLast), Id(neverRan)], Ids(ascending));
        Assert.Equal([Id(ranLast), Id(ranFirst), Id(neverRan)], Ids(descending));
    }

    [Fact]
    public async Task List_is_ordered_by_the_count_of_the_newest_run_with_a_stopped_run_and_then_no_run_last_when_sort_is_violations()
    {
        var neverRan = await CreateAsync("a never ran");
        var stopped = await CreateAsync("b stopped");
        var five = await CreateAsync("c five");
        var two = await CreateAsync("d two");
        var alsoTwo = await CreateAsync("e two as well");
        _engine.Answer(EngineStub.Run, HttpStatusCode.OK, RunAnswers.Numbered(1));
        // The newest run counts, not an earlier one: this control found one, then five.
        await RunRequests.StartAsync(_client, Id(five));
        _clock.Advance(TimeSpan.FromMinutes(1));
        _engine.Answer(EngineStub.Run, HttpStatusCode.OK, RunAnswers.Numbered(5));
        await RunRequests.StartAsync(_client, Id(five));
        _engine.Answer(EngineStub.Run, HttpStatusCode.OK, RunAnswers.Numbered(2));
        await RunRequests.StartAsync(_client, Id(two));
        await RunRequests.StartAsync(_client, Id(alsoTwo));
        await RunRequests.StartAsync(_client, Id(stopped));
        _clock.Advance(TimeSpan.FromMinutes(1));
        _engine.Answer(EngineStub.Run, HttpStatusCode.GatewayTimeout, EngineFixtures.Read("problem-query-timeout.json"));
        await RunRequests.StartAsync(_client, Id(stopped));

        var ascending = await ControlRequests.ListAsync(_client, _testId, "&sort=violations");
        var descending = await ControlRequests.ListAsync(_client, _testId, "&sort=violations&dir=desc");

        Assert.Equal([Id(two), Id(alsoTwo), Id(five), Id(stopped), Id(neverRan)], Ids(ascending));
        Assert.Equal([Id(five), Id(two), Id(alsoTwo), Id(stopped), Id(neverRan)], Ids(descending));
    }

    [Fact]
    public async Task List_pages_a_sorted_list_without_repeating_or_dropping_a_control()
    {
        var created = new List<int>();
        foreach (var label in new[] { "1", "2", "3", "4", "5" })
        {
            created.Add(Id(await CreateAsync(label)));
        }

        // No control here ran, so the run's start orders nothing and the name alone decides.
        var pages = new List<int>();
        foreach (var page in new[] { 1, 2, 3 })
        {
            pages.AddRange(Ids(await ControlRequests.ListAsync(_client, _testId, $"&sort=lastRun&dir=desc&pageSize=2&page={page}")));
        }

        Assert.Equal(created, pages);
    }

    [Fact]
    public async Task List_pages_its_items_and_keeps_the_total_when_the_page_is_past_the_end()
    {
        var first = await CreateAsync("1");
        var second = await CreateAsync("2");
        var third = await CreateAsync("3");

        var pageOne = await ControlRequests.ListAsync(_client, _testId, "&pageSize=2");
        var pageTwo = await ControlRequests.ListAsync(_client, _testId, "&pageSize=2&page=2");
        var pastTheEnd = await ControlRequests.ListAsync(_client, _testId, "&pageSize=2&page=3");

        Assert.Equal([Id(first), Id(second)], Ids(pageOne));
        Assert.Equal([Id(third)], Ids(pageTwo));
        Assert.Empty(Ids(pastTheEnd));
        Assert.All([pageOne, pageTwo, pastTheEnd], page => Assert.Equal(3, page.GetProperty("total").GetInt32()));
        Assert.Equal((1, 2), (pageOne.GetProperty("page").GetInt32(), pageOne.GetProperty("pageSize").GetInt32()));
        Assert.Equal((3, 2), (pastTheEnd.GetProperty("page").GetInt32(), pastTheEnd.GetProperty("pageSize").GetInt32()));
        Assert.Equal(4, pageOne.EnumerateObject().Count());
    }

    [Fact]
    public async Task List_uses_page_1_and_a_page_size_of_25_when_neither_is_given()
    {
        var list = await ControlRequests.ListAsync(_client, _testId);

        Assert.Equal((1, 25), (list.GetProperty("page").GetInt32(), list.GetProperty("pageSize").GetInt32()));
    }

    [Theory]
    [InlineData("page=0", """[{"path":"page","code":"OUT_OF_RANGE","params":{"min":1,"max":1000000}}]""")]
    [InlineData("page=1000001", """[{"path":"page","code":"OUT_OF_RANGE","params":{"min":1,"max":1000000}}]""")]
    [InlineData("pageSize=0", """[{"path":"pageSize","code":"OUT_OF_RANGE","params":{"min":1,"max":200}}]""")]
    [InlineData("pageSize=201", """[{"path":"pageSize","code":"OUT_OF_RANGE","params":{"min":1,"max":200}}]""")]
    [InlineData("pageSize=abc", """[{"path":"pageSize","code":"MALFORMED","params":{}}]""")]
    [InlineData("page=1.5", """[{"path":"page","code":"MALFORMED","params":{}}]""")]
    [InlineData("active=maybe", """[{"path":"active","code":"MALFORMED","params":{}}]""")]
    [InlineData("active=TRUE", """[{"path":"active","code":"MALFORMED","params":{}}]""")]
    [InlineData("sort=created", """[{"path":"sort","code":"MALFORMED","params":{}}]""")]
    [InlineData("sort=Name", """[{"path":"sort","code":"MALFORMED","params":{}}]""")]
    [InlineData("dir=up", """[{"path":"dir","code":"MALFORMED","params":{}}]""")]
    [InlineData("active=x&sort=x&dir=x", """[{"path":"active","code":"MALFORMED","params":{}},{"path":"sort","code":"MALFORMED","params":{}},{"path":"dir","code":"MALFORMED","params":{}}]""")]
    [InlineData("page=0&pageSize=500&active=x", """[{"path":"page","code":"OUT_OF_RANGE","params":{"min":1,"max":1000000}},{"path":"pageSize","code":"OUT_OF_RANGE","params":{"min":1,"max":200}},{"path":"active","code":"MALFORMED","params":{}}]""")]
    public async Task List_returns_400_naming_the_parameter_when_a_query_value_is_out_of_range_or_not_a_word_it_accepts(string query, string expectedErrors)
    {
        var response = await _client.GetAsync($"{ControlRequests.Path}?{query}");

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.BadRequest, "REQUEST_INVALID");
        HttpAssert.JsonEqual(expectedErrors, HttpAssert.Errors(problem));
    }

    [Fact]
    public async Task List_returns_200_when_page_and_page_size_are_at_their_maximum()
    {
        var response = await _client.GetAsync($"{ControlRequests.Path}?search={_testId}&page=1000000&pageSize=200");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task List_keeps_only_matching_controls_when_a_root_entity_is_asked_for()
    {
        var employee = await CreateAsync("employee rule");
        var department = await ControlRequests.CreateAsync(_client, TestData.Name(_testId, "department rule"), Examples.Definition(DepartmentExample));

        var departments = await ControlRequests.ListAsync(_client, _testId, $"&rootEntity={Examples.RootEntity(DepartmentExample)}");
        var employees = await ControlRequests.ListAsync(_client, _testId, $"&rootEntity={Examples.RootEntity(Examples.First)}");

        Assert.Equal([Id(department)], Ids(departments));
        Assert.Equal([Id(employee)], Ids(employees));
    }

    [Theory]
    [InlineData("pct 100% sure", "pct 100 or so sure")]
    [InlineData("und a_b end", "und axb end")]
    [InlineData("brk [x] end", "brk x end")]
    public async Task List_search_takes_a_wildcard_character_literally_when_the_name_contains_it(string label, string whatAWildcardWouldAlsoMatch)
    {
        var literal = await CreateAsync(label);
        await CreateAsync(whatAWildcardWouldAlsoMatch);

        // The search carries this test's id, so it sees only the two controls above.
        var found = await ControlRequests.ListAsync(_client, $"{_testId}-{label}", "&active=all");

        Assert.Equal([Id(literal)], Ids(found));
    }

    [Fact]
    public async Task List_search_ignores_case_and_surrounding_spaces()
    {
        var created = await CreateAsync("MixedCase Label");

        var response = await _client.GetAsync($"{ControlRequests.Path}?search={Uri.EscapeDataString($"  {_testId}-mixedcase LABEL ")}");

        Assert.Equal([Id(created)], Ids(await response.ReadJsonAsync()));
    }

    [Fact]
    public async Task List_item_is_a_summary_with_a_null_last_run_when_the_control_never_ran()
    {
        var created = await ControlRequests.CreateAsync(_client, TestData.Name(_testId), description: "described");

        var item = Assert.Single((await ControlRequests.ListAsync(_client, _testId)).GetProperty("items").EnumerateArray());

        HttpAssert.JsonEqual(
            $$"""
            {
              "id": {{Id(created)}},
              "name": {{created.GetProperty("name").GetRawText()}},
              "description": "described",
              "rootEntity": "{{Examples.RootEntity(Examples.First)}}",
              "version": 1,
              "isActive": true,
              "createdAt": {{created.GetProperty("createdAt").GetRawText()}},
              "updatedAt": {{created.GetProperty("updatedAt").GetRawText()}},
              "lastRun": null
            }
            """,
            item.GetRawText());
    }

    private Task<JsonElement> CreateAsync(string label) => ControlRequests.CreateAsync(_client, TestData.Name(_testId, label));

    /// <summary>The first example's rule with another root entity: the stubbed engine accepts any definition the schema does.</summary>
    private static string DefinitionOf(string rootEntity)
    {
        var definition = JsonNode.Parse(Examples.Definition(Examples.First))!;
        definition["rootEntity"] = rootEntity;
        return definition.ToJsonString();
    }

    /// <summary>The entity keys of the glossary fixture in the order of their plural labels in the default language.</summary>
    private static List<string> EntityKeysByLabel()
    {
        using var glossary = JsonDocument.Parse(EngineFixtures.Read("glossary.json"));
        var language = glossary.RootElement.GetProperty("defaultLanguage").GetString()!;
        return [.. glossary.RootElement.GetProperty("entities").EnumerateArray()
            .OrderBy(entity => entity.GetProperty("label").GetProperty("plural").GetProperty(language).GetString(), StringComparer.OrdinalIgnoreCase)
            .Select(entity => entity.GetProperty("key").GetString()!)];
    }

    private static int Id(JsonElement control) => control.GetProperty("id").GetInt32();

    private static IEnumerable<int> Ids(JsonElement page) => page.GetProperty("items").EnumerateArray().Select(Id);
}
