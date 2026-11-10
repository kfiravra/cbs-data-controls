using System.Net;
using System.Text.Json;
using DataControls.Api.Tests.Support;

namespace DataControls.Api.Tests.Controls;

/// <summary><c>GET /api/v1/controls</c>. Every list here is narrowed to this test's own controls by its id.</summary>
[Collection(ApiCollection.Name)]
public sealed class ControlListTests(ApiFixture fixture)
{
    private const string DepartmentExample = "department-without-active-employees";

    private readonly HttpClient _client = fixture.CreateClient();
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
    [InlineData("page=0&pageSize=500&active=x", """[{"path":"page","code":"OUT_OF_RANGE","params":{"min":1,"max":1000000}},{"path":"pageSize","code":"OUT_OF_RANGE","params":{"min":1,"max":200}},{"path":"active","code":"MALFORMED","params":{}}]""")]
    public async Task List_returns_400_naming_the_parameter_when_a_query_value_is_out_of_range_or_not_a_word_it_accepts(string query, string expectedErrors)
    {
        var response = await _client.GetAsync($"{ControlRequests.Path}?{query}");

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.BadRequest, "REQUEST_INVALID");
        HttpAssert.JsonEqual(expectedErrors, HttpAssert.Errors(problem));
    }

    [Fact]
    public async Task List_accepts_the_largest_page_and_page_size()
    {
        var response = await _client.GetAsync($"{ControlRequests.Path}?search={_testId}&page=1000000&pageSize=200");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task List_keeps_only_the_root_entity_asked_for()
    {
        var employee = await CreateAsync("employee rule");
        var department = await ControlRequests.CreateAsync(_client, TestData.Name(_testId, "department rule"), Examples.Definition(DepartmentExample));

        var departments = await ControlRequests.ListAsync(_client, _testId, "&rootEntity=department");
        var employees = await ControlRequests.ListAsync(_client, _testId, "&rootEntity=employee");

        Assert.Equal([Id(department)], Ids(departments));
        Assert.Equal([Id(employee)], Ids(employees));
    }

    [Theory]
    [InlineData("100%", "percent")]
    [InlineData("a_b", "underscore")]
    [InlineData("[x]", "bracket")]
    public async Task List_search_takes_wildcard_characters_literally(string search, string expectedLabel)
    {
        var expected = new Dictionary<string, JsonElement>
        {
            ["percent"] = await CreateAsync("is 100% sure"),
            ["underscore"] = await CreateAsync("has a_b inside"),
            ["bracket"] = await CreateAsync("with [x] marks"),
            ["plain"] = await CreateAsync("100 axb x"),
        };

        // The search is the wildcard text alone, so other tests' controls may match too; only this test's count.
        var response = await _client.GetAsync($"{ControlRequests.Path}?pageSize=200&search={Uri.EscapeDataString(search)}");
        var found = await response.ReadJsonAsync();

        var mine = found.GetProperty("items").EnumerateArray().Where(item => item.GetProperty("name").GetString()!.Contains(_testId)).Select(Id);
        Assert.Equal([Id(expected[expectedLabel])], mine);
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
              "rootEntity": "employee",
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

    private static int Id(JsonElement control) => control.GetProperty("id").GetInt32();

    private static IEnumerable<int> Ids(JsonElement page) => page.GetProperty("items").EnumerateArray().Select(Id);
}
