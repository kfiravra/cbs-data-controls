using System.Diagnostics;
using System.Net;
using DataControls.Api.Tests.Support;
using Xunit.Abstractions;

namespace DataControls.Api.Tests.Runs;

/// <summary>
/// <c>GET /api/v1/runs/{id}/results</c>: paging, search, the condition filter and sorting, all answered
/// from the stored snapshot.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class RunResultsTests(ApiFixture fixture, ITestOutputHelper output)
{
    private readonly HttpClient _client = fixture.CreateClient();
    private readonly EngineStub _engine = fixture.Factory.Engine;
    private readonly string _testId = TestData.NewTestId();
    private readonly string _rootEntity = RunAnswers.AnyRootEntity;

    [Fact]
    public async Task Results_page_as_25_25_and_10_when_the_run_stored_60_violations()
    {
        var run = await RunAsync(RunAnswers.Numbered(60));

        var first = await RunRequests.ResultsAsync(_client, run);
        var second = await RunRequests.ResultsAsync(_client, run, "?page=2");
        var third = await RunRequests.ResultsAsync(_client, run, "?page=3");
        var fourth = await RunRequests.ResultsAsync(_client, run, "?page=4");

        Assert.Equal(Numbers(1001, 25), RunRequests.Keys(first));
        Assert.Equal(Numbers(1026, 25), RunRequests.Keys(second));
        Assert.Equal(Numbers(1051, 10), RunRequests.Keys(third));
        Assert.Empty(RunRequests.Keys(fourth));
        Assert.All([first, second, third, fourth], page => Assert.Equal(60, page.GetProperty("total").GetInt32()));
        Assert.Equal(Enumerable.Range(1, 25), first.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("seq").GetInt32()));
        Assert.Empty(_engine.CallsTo(EngineStub.Run).Skip(1));
    }

    [Fact]
    public async Task Run_reports_cap_exceeded_and_stores_what_was_returned_when_the_total_is_above_it()
    {
        _engine.Answer(EngineStub.Run, HttpStatusCode.OK, RunAnswers.Numbered(3, total: 8));
        var control = await ControlRequests.CreateAsync(_client, TestData.Name(_testId));

        var run = await RunRequests.StartAsync(_client, control.GetProperty("id").GetInt32());

        Assert.Equal((8, 3, true), (run.GetProperty("totalCount").GetInt32(), run.GetProperty("storedCount").GetInt32(), run.GetProperty("capExceeded").GetBoolean()));
        Assert.Equal(3, (await RunRequests.ResultsAsync(_client, run.GetProperty("id").GetInt32())).GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task Results_are_ordered_by_key_order_or_by_display_text_with_seq_breaking_a_tie_when_two_rows_share_a_display()
    {
        // Rows 3 and 4 carry the same display values, so only seq can order them, in the direction asked for.
        var run = await RunAsync(RunAnswers.Build(_rootEntity, [Row("1", "b"), Row("2", "c"), Row("3", "a"), Row("4", "a")], 4));

        var byDefault = await RunRequests.ResultsAsync(_client, run);
        var byKeyDescending = await RunRequests.ResultsAsync(_client, run, "?sort=key&dir=desc");
        var byDisplay = await RunRequests.ResultsAsync(_client, run, "?sort=display");
        var byDisplayDescending = await RunRequests.ResultsAsync(_client, run, "?sort=display&dir=desc");

        Assert.Equal(["1", "2", "3", "4"], RunRequests.Keys(byDefault));
        Assert.Equal(["4", "3", "2", "1"], RunRequests.Keys(byKeyDescending));
        Assert.Equal(["3", "4", "1", "2"], RunRequests.Keys(byDisplay));
        Assert.Equal(["2", "1", "4", "3"], RunRequests.Keys(byDisplayDescending));
    }

    [Fact]
    public async Task Results_are_ordered_by_an_identifying_text_field_with_a_missing_value_last_and_seq_breaking_a_tie()
    {
        var (position, field) = RunAnswers.IdentifyingField(_rootEntity, number: false);
        var run = await RunAsync(RunAnswers.Build(_rootEntity, [Differing("1", position, "b"), Differing("2", position, null), Differing("3", position, "a"), Differing("4", position, "b")], 4));

        var ascending = await RunRequests.ResultsAsync(_client, run, $"?sort=field&field={field}");
        var descending = await RunRequests.ResultsAsync(_client, run, $"?sort=field&field={field}&dir=desc");

        // Rows 1 and 4 hold the same value: seq orders them, ascending in both directions. Row 2 has none.
        Assert.Equal(["3", "1", "4", "2"], RunRequests.Keys(ascending));
        Assert.Equal(["1", "4", "3", "2"], RunRequests.Keys(descending));
    }

    [Fact]
    public async Task Results_are_ordered_by_the_value_of_an_identifying_number_field_and_not_by_its_digits()
    {
        var (position, field) = RunAnswers.IdentifyingField(_rootEntity, number: true);
        var run = await RunAsync(RunAnswers.Build(_rootEntity, [Differing("1", position, "100"), Differing("2", position, "9"), Differing("3", position, null), Differing("4", position, "10")], 4));

        var ascending = await RunRequests.ResultsAsync(_client, run, $"?sort=field&field={field}");
        var descending = await RunRequests.ResultsAsync(_client, run, $"?sort=field&field={field}&dir=desc");

        // As text the order would be 10, 100, 9.
        Assert.Equal(["2", "4", "1", "3"], RunRequests.Keys(ascending));
        Assert.Equal(["1", "4", "2", "3"], RunRequests.Keys(descending));
    }

    [Fact]
    public async Task Results_are_ordered_by_the_number_of_reasons_and_then_by_their_text_when_sort_is_reasons()
    {
        var run = await RunAsync(RunAnswers.Build(
            _rootEntity,
            [
                new RunAnswers.Violation("1", ["c1"], ReasonText: "b"),
                new RunAnswers.Violation("2", ["c1", "c2"], ReasonText: "a"),
                new RunAnswers.Violation("3", ["c1"], ReasonText: "a"),
                new RunAnswers.Violation("4", ["c1"], ReasonText: "a"),
            ],
            4));

        var ascending = await RunRequests.ResultsAsync(_client, run, "?sort=reasons");
        var descending = await RunRequests.ResultsAsync(_client, run, "?sort=reasons&dir=desc");

        // One reason before two; among one reason by its text; rows 3 and 4 are equal in both and stand by seq.
        Assert.Equal(["3", "4", "1", "2"], RunRequests.Keys(ascending));
        Assert.Equal(["2", "1", "3", "4"], RunRequests.Keys(descending));
    }

    [Fact]
    public async Task Results_return_400_on_field_when_the_field_is_not_an_identifying_field_of_the_run_root_entity()
    {
        var run = await RunAsync(RunAnswers.Numbered(1));

        foreach (var field in new[] { "no_such_field", RunAnswers.OtherField(_rootEntity), "x\"; DROP TABLE dq.Run; --" })
        {
            var response = await _client.GetAsync($"{RunRequests.PathOf(run)}/results?sort=field&field={Uri.EscapeDataString(field)}");

            var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.BadRequest, "REQUEST_INVALID");
            HttpAssert.JsonEqual("""[{"path":"field","code":"MALFORMED","params":{}}]""", HttpAssert.Errors(problem));
        }

        // The rows are still there, and a field that is given without sort=field is not read at all.
        var unsorted = await RunRequests.ResultsAsync(_client, run, "?field=no_such_field");
        Assert.Equal(1, unsorted.GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task Results_return_404_before_the_field_is_checked_when_the_run_does_not_exist()
    {
        var response = await _client.GetAsync($"{RunRequests.PathOf(int.MaxValue)}/results?sort=field&field=no_such_field");

        await HttpAssert.ProblemAsync(response, HttpStatusCode.NotFound, "RUN_NOT_FOUND");
    }

    [Fact]
    public async Task Results_search_reads_the_display_values_in_the_glossary_order_when_the_engine_wrote_them_in_another()
    {
        var violation = new RunAnswers.Violation("1051", ["c1"]);
        var tokens = RunAnswers.DisplayTokens(_rootEntity, violation);
        var run = await RunAsync(RunAnswers.Build(_rootEntity, [violation, new RunAnswers.Violation("1052", ["c1"])], 2));

        var inGlossaryOrder = await RunRequests.ResultsAsync(_client, run, $"?search={Uri.EscapeDataString($"{tokens[0]} {tokens[1]}")}");
        var inTheOrderWritten = await RunRequests.ResultsAsync(_client, run, $"?search={Uri.EscapeDataString($"{tokens[1]} {tokens[0]}")}");

        Assert.True(tokens.Count >= 2, "The test needs an entity with two identifying fields.");
        Assert.Equal(["1051"], RunRequests.Keys(inGlossaryOrder));
        Assert.Empty(RunRequests.Keys(inTheOrderWritten));
    }

    [Fact]
    public async Task Results_search_finds_hebrew_in_the_display_text_and_in_the_reason_text()
    {
        var hebrew = TestData.HebrewText;
        var inDisplay = RunAnswers.Uniform(_rootEntity, "1", hebrew);
        var inReason = new RunAnswers.Violation("2", ["c1"], ReasonText: $"reason {hebrew}");
        var run = await RunAsync(RunAnswers.Build(_rootEntity, [inDisplay, inReason, new RunAnswers.Violation("3", ["c1"])], 3));

        var found = await RunRequests.ResultsAsync(_client, run, $"?search={Uri.EscapeDataString($"  {hebrew}  ")}");
        var emptySearch = await RunRequests.ResultsAsync(_client, run, "?search=%20%20");

        Assert.Equal(["1", "2"], RunRequests.Keys(found));
        Assert.Equal(2, found.GetProperty("total").GetInt32());
        Assert.Equal(3, emptySearch.GetProperty("total").GetInt32());
        Assert.Contains(hebrew, found.GetProperty("items")[0].GetProperty("display").GetRawText());
    }

    [Theory]
    [InlineData("50%", "percent")]
    [InlineData("a_b", "underscore")]
    [InlineData("[x]", "bracket")]
    [InlineData("AXB", "plain")]
    public async Task Results_search_takes_wildcard_characters_literally_and_ignores_case(string search, string expectedKey)
    {
        var run = await RunAsync(RunAnswers.Build(
            _rootEntity,
            [
                new RunAnswers.Violation("percent", ["c1"], ReasonText: "raise of 50% given"),
                new RunAnswers.Violation("underscore", ["c1"], ReasonText: "code a_b used"),
                new RunAnswers.Violation("bracket", ["c1"], ReasonText: "marked [x] twice"),
                new RunAnswers.Violation("plain", ["c1"], ReasonText: "50 axb x"),
            ],
            4));

        var found = await RunRequests.ResultsAsync(_client, run, $"?search={Uri.EscapeDataString(search)}");

        Assert.Equal([expectedKey], RunRequests.Keys(found));
    }

    [Fact]
    public async Task Results_keep_only_the_violations_that_matched_the_condition_asked_for()
    {
        var run = await RunAsync(RunAnswers.Build(
            _rootEntity,
            [new RunAnswers.Violation("1", ["c1", "c2"]), new RunAnswers.Violation("2", ["c1"]), new RunAnswers.Violation("3", ["c2", "c3"])],
            3));

        var c2 = await RunRequests.ResultsAsync(_client, run, "?condition=c2");
        var c2WithSearch = await RunRequests.ResultsAsync(_client, run, $"?condition=c2&search={Uri.EscapeDataString(RunAnswers.ReasonOf("c3", "3"))}");
        var unknown = await RunRequests.ResultsAsync(_client, run, "?condition=c9");

        Assert.Equal(["1", "3"], RunRequests.Keys(c2));
        Assert.Equal(2, c2.GetProperty("total").GetInt32());
        Assert.Equal(["3"], RunRequests.Keys(c2WithSearch));
        Assert.Equal(0, unknown.GetProperty("total").GetInt32());
    }

    [Theory]
    [InlineData("sort=name", """[{"path":"sort","code":"MALFORMED","params":{}}]""")]
    [InlineData("dir=up", """[{"path":"dir","code":"MALFORMED","params":{}}]""")]
    [InlineData("sort=field", """[{"path":"field","code":"REQUIRED","params":{}}]""")]
    [InlineData("sort=field&field=", """[{"path":"field","code":"REQUIRED","params":{}}]""")]
    [InlineData("pageSize=201", """[{"path":"pageSize","code":"OUT_OF_RANGE","params":{"min":1,"max":200}}]""")]
    [InlineData("page=x", """[{"path":"page","code":"MALFORMED","params":{}}]""")]
    public async Task Results_return_400_naming_the_parameter_when_a_query_value_is_not_accepted(string query, string expectedErrors)
    {
        var run = await RunAsync(RunAnswers.Numbered(1));

        var response = await _client.GetAsync($"{RunRequests.PathOf(run)}/results?{query}");

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.BadRequest, "REQUEST_INVALID");
        HttpAssert.JsonEqual(expectedErrors, HttpAssert.Errors(problem));
    }

    [Fact]
    public async Task Results_are_an_empty_page_when_the_run_failed()
    {
        _engine.Refuse(EngineStub.Run);
        var control = await ControlRequests.CreateAsync(_client, TestData.Name(_testId));
        var run = await RunRequests.StartAsync(_client, control.GetProperty("id").GetInt32());

        var results = await RunRequests.ResultsAsync(_client, run.GetProperty("id").GetInt32());

        HttpAssert.JsonEqual("""{"items":[],"total":0,"page":1,"pageSize":25}""", results.GetRawText());
    }

    [Fact]
    public async Task Run_stores_5000_violations_in_one_snapshot_when_the_engine_returns_the_full_cap()
    {
        var control = await ControlRequests.CreateAsync(_client, TestData.Name(_testId));
        _engine.Answer(EngineStub.Run, HttpStatusCode.OK, RunAnswers.Numbered(5000, total: 5200));
        var watch = Stopwatch.StartNew();

        var run = await RunRequests.StartAsync(_client, control.GetProperty("id").GetInt32());

        watch.Stop();
        output.WriteLine($"A run of 5000 violations was stored and answered in {watch.ElapsedMilliseconds} ms.");
        Assert.Equal((5200, 5000, true), (run.GetProperty("totalCount").GetInt32(), run.GetProperty("storedCount").GetInt32(), run.GetProperty("capExceeded").GetBoolean()));
        var lastPage = await RunRequests.ResultsAsync(_client, run.GetProperty("id").GetInt32(), "?page=25&pageSize=200");
        Assert.Equal(Numbers(5801, 200), RunRequests.Keys(lastPage));
    }

    private async Task<int> RunAsync(string engineAnswer)
    {
        var control = await ControlRequests.CreateAsync(_client, TestData.Name(_testId));
        _engine.Answer(EngineStub.Run, HttpStatusCode.OK, engineAnswer);
        var run = await RunRequests.StartAsync(_client, control.GetProperty("id").GetInt32());
        Assert.Equal("succeeded", run.GetProperty("status").GetString());
        return run.GetProperty("id").GetInt32();
    }

    private RunAnswers.Violation Row(string key, string text) => RunAnswers.Uniform(_rootEntity, key, text);

    private RunAnswers.Violation Differing(string key, int position, string? value) => RunAnswers.Differing(_rootEntity, key, position, value);

    private static IEnumerable<string> Numbers(int from, int count) => Enumerable.Range(from, count).Select(number => number.ToString());
}
