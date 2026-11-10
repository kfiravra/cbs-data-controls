using System.Net;
using System.Text.Json;
using DataControls.Api.Tests.Support;

namespace DataControls.Api.Tests.Runs;

/// <summary><c>POST /api/v1/controls/{id}/runs</c> and the run it answers, against a stubbed engine.</summary>
[Collection(ApiCollection.Name)]
public sealed class RunTests(ApiFixture fixture)
{
    private const string Timestamp = @"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$";

    private readonly HttpClient _client = fixture.CreateClient();
    private readonly EngineStub _engine = fixture.Factory.Engine;
    private readonly string _testId = TestData.NewTestId();

    public static TheoryData<string> ExampleIds => Examples.Ids;

    [Fact]
    public async Task Run_returns_201_with_location_counts_and_summary_when_the_engine_answers_the_contract_example()
    {
        var control = await CreateAsync();
        var engineAnswer = EngineFixtures.Read("run.json");
        _engine.Answer(EngineStub.Run, HttpStatusCode.OK, engineAnswer);
        using var expected = JsonDocument.Parse(engineAnswer);

        var response = await _client.PostAsync(RunRequests.RunsOf(Id(control)), Body.Json("""{"runDate":"2026-11-01"}"""));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var run = await response.ReadJsonAsync();
        Assert.Equal(RunRequests.PathOf(Id(run)), response.Headers.Location?.OriginalString);
        Assert.Equal(Id(control), run.GetProperty("controlId").GetInt32());
        Assert.Equal(control.GetProperty("name").GetString(), run.GetProperty("controlName").GetString());
        Assert.Equal(1, run.GetProperty("controlVersion").GetInt32());
        Assert.Equal(Examples.RootEntity(Examples.First), run.GetProperty("rootEntity").GetString());
        Assert.Equal("2026-11-01", run.GetProperty("runDate").GetString());
        Assert.Equal("he", run.GetProperty("language").GetString());
        Assert.Matches(Timestamp, run.GetProperty("startedAt").GetString());
        Assert.Matches(Timestamp, run.GetProperty("finishedAt").GetString());
        Assert.Equal("succeeded", run.GetProperty("status").GetString());
        // The contract's example: three found, two returned under a cap of two, both conditions counted over all three.
        Assert.Equal(3, run.GetProperty("totalCount").GetInt32());
        Assert.Equal(2, run.GetProperty("storedCount").GetInt32());
        Assert.True(run.GetProperty("capExceeded").GetBoolean());
        Assert.Equal(expected.RootElement.GetProperty("durationMs").GetInt32(), run.GetProperty("durationMs").GetInt32());
        Assert.Equal(expected.RootElement.GetProperty("sentence").GetString(), run.GetProperty("sentence").GetString());
        HttpAssert.JsonEqual(expected.RootElement.GetProperty("sentenceParts").GetRawText(), run.GetProperty("sentenceParts").GetRawText());
        HttpAssert.JsonEqual(expected.RootElement.GetProperty("conditions").GetRawText(), run.GetProperty("conditions").GetRawText());
        Assert.Equal(JsonValueKind.Null, run.GetProperty("error").ValueKind);
        Assert.Equal(JsonValueKind.Null, run.GetProperty("previousRun").ValueKind);
        Assert.Equal(19, run.EnumerateObject().Count());
    }

    [Fact]
    public async Task Run_stores_each_violation_as_received_with_its_reason_parts_when_it_succeeds()
    {
        var control = await CreateAsync();
        var engineAnswer = EngineFixtures.Read("run.json");
        _engine.Answer(EngineStub.Run, HttpStatusCode.OK, engineAnswer);
        using var expected = JsonDocument.Parse(engineAnswer);

        var run = await RunRequests.StartAsync(_client, Id(control));
        var results = await RunRequests.ResultsAsync(_client, Id(run));

        var sent = expected.RootElement.GetProperty("violations").EnumerateArray().ToList();
        var items = results.GetProperty("items").EnumerateArray().ToList();
        Assert.Equal(sent.Count, items.Count);
        Assert.Equal(2, results.GetProperty("total").GetInt32());
        for (var index = 0; index < sent.Count; index++)
        {
            Assert.Equal(index + 1, items[index].GetProperty("seq").GetInt32());
            foreach (var member in new[] { "key", "display", "matched", "reasons", "reasonText" })
            {
                HttpAssert.JsonEqual(sent[index].GetProperty(member).GetRawText(), items[index].GetProperty(member).GetRawText());
            }

            Assert.Equal(6, items[index].EnumerateObject().Count());
        }

        Assert.Contains("textParts", items[0].GetProperty("reasons")[0].EnumerateObject().Select(member => member.Name));
    }

    [Fact]
    public async Task Run_sends_the_definition_the_resolved_date_and_the_row_cap_to_the_engine()
    {
        var control = await CreateAsync();
        _engine.Answer(EngineStub.Run, HttpStatusCode.OK, RunAnswers.Numbered(1));

        await RunRequests.StartAsync(_client, Id(control), """{"runDate":"2024-02-29"}""");

        var call = Assert.Single(_engine.CallsTo(EngineStub.Run));
        HttpAssert.JsonEqual(
            $$"""{"definition":{{control.GetProperty("definition").GetRawText()}},"runDate":"2024-02-29","rowCap":5000}""",
            call.Body);
        Assert.Equal("he", call.Headers["Accept-Language"]);
    }

    [Theory]
    [MemberData(nameof(ExampleIds))]
    public async Task Run_returns_the_expected_keys_and_matched_ids_in_order_when_the_control_is_an_example(string exampleId)
    {
        var example = Examples.Example(exampleId);
        var expected = example.GetProperty("expected");
        var control = await ControlRequests.CreateAsync(_client, TestData.Name(_testId, exampleId), Examples.Definition(exampleId));
        _engine.Answer(EngineStub.Run, HttpStatusCode.OK, RunAnswers.ForExample(exampleId));

        var run = await RunRequests.StartAsync(_client, Id(control), $$"""{"runDate":{{example.GetProperty("runDate").GetRawText()}} }""");
        var results = await RunRequests.ResultsAsync(_client, Id(run), "?pageSize=200");

        Assert.Equal("succeeded", run.GetProperty("status").GetString());
        Assert.Equal(expected.GetProperty("total").GetInt32(), run.GetProperty("totalCount").GetInt32());
        Assert.Equal(example.GetProperty("definition").GetProperty("rootEntity").GetString(), run.GetProperty("rootEntity").GetString());
        Assert.Equal(
            RunRequests.KeysAndMatched(expected.GetProperty("violations")),
            RunRequests.KeysAndMatched(results.GetProperty("items")));
    }

    [Fact]
    public async Task Run_is_closed_failed_with_control_definition_outdated_and_the_engine_errors_when_the_engine_answers_422()
    {
        var engineProblem = EngineFixtures.Read("problem-definition-invalid.json");
        using var expected = JsonDocument.Parse(engineProblem);

        var run = await RunWithEngineAnswerAsync(HttpStatusCode.UnprocessableEntity, engineProblem);

        AssertClosed(run, "failed", "CONTROL_DEFINITION_OUTDATED");
        HttpAssert.JsonEqual(
            $$"""{"errors":{{expected.RootElement.GetProperty("errors").GetRawText()}} }""",
            run.GetProperty("error").GetProperty("params").GetRawText());
    }

    [Fact]
    public async Task Run_is_closed_timed_out_with_the_timeout_seconds_when_the_engine_answers_504()
    {
        var run = await RunWithEngineAnswerAsync(HttpStatusCode.GatewayTimeout, EngineFixtures.Read("problem-query-timeout.json"));

        AssertClosed(run, "timed_out", "QUERY_TIMEOUT");
        HttpAssert.JsonEqual("""{"timeoutSeconds":30}""", run.GetProperty("error").GetProperty("params").GetRawText());
    }

    [Fact]
    public async Task Run_is_closed_failed_with_database_unavailable_when_the_engine_answers_503()
    {
        var run = await RunWithEngineAnswerAsync(HttpStatusCode.ServiceUnavailable, EngineFixtures.Read("problem-database-unavailable.json"));

        AssertClosed(run, "failed", "DATABASE_UNAVAILABLE");
        Assert.Equal("{}", run.GetProperty("error").GetProperty("params").GetRawText());
    }

    [Fact]
    public async Task Run_is_closed_failed_with_engine_unavailable_when_the_connection_is_refused()
    {
        var control = await CreateAsync();
        _engine.Refuse(EngineStub.Run);

        var run = await RunRequests.StartAsync(_client, Id(control));

        AssertClosed(run, "failed", "ENGINE_UNAVAILABLE");
    }

    [Theory]
    [InlineData("""{"totalCount":1}""")]
    [InlineData("""{"runDate":"2026-11-01","totalCount":"3","returnedCount":0,"capExceeded":false,"durationMs":1,"engineVersion":"0.1.0","glossaryVersion":"1.0.0","sentence":"s","sentenceParts":[],"conditions":[],"violations":[]}""")]
    [InlineData("""{"runDate":"2026-11-01","totalCount":0,"returnedCount":1,"capExceeded":false,"durationMs":1,"engineVersion":"0.1.0","glossaryVersion":"1.0.0","sentence":"s","sentenceParts":[],"conditions":[],"violations":[{"key":"1","display":{},"matched":["c1"],"reasons":[],"reasonText":"r"}]}""")]
    [InlineData("""{"runDate":"2026-11-01","totalCount":1,"returnedCount":1,"capExceeded":false,"durationMs":1,"engineVersion":"0.1.0","glossaryVersion":"1.0.0","sentence":"s","sentenceParts":[],"conditions":[],"violations":[{"key":"","display":{},"matched":["c1"],"reasons":[],"reasonText":"r"}]}""")]
    [InlineData("""{"runDate":"2026-11-01","totalCount":1,"returnedCount":1,"capExceeded":false,"durationMs":1,"engineVersion":"0.1.0","glossaryVersion":"1.0.0","sentence":"s","sentenceParts":[],"conditions":[],"violations":[{"key":"1","matched":["c1"],"reasons":[],"reasonText":"r"}]}""")]
    public async Task Run_is_closed_failed_with_internal_error_when_the_engine_body_is_not_the_contract(string body)
    {
        var run = await RunWithEngineAnswerAsync(HttpStatusCode.OK, body);

        AssertClosed(run, "failed", "INTERNAL_ERROR");
    }

    [Fact]
    public async Task Run_is_closed_failed_with_internal_error_and_no_rows_when_the_snapshot_cannot_be_stored()
    {
        // An engine version longer than its column makes the one save of the snapshot fail in the database.
        var answer = RunAnswers.Numbered(3).Replace($"\"{RunAnswers.EngineVersion}\"", $"\"{new string('9', 40)}\"");

        var run = await RunWithEngineAnswerAsync(HttpStatusCode.OK, answer);

        AssertClosed(run, "failed", "INTERNAL_ERROR");
        Assert.Equal(0, (await RunRequests.ResultsAsync(_client, Id(run))).GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task Run_returns_409_control_archived_and_opens_no_run_when_the_control_is_archived()
    {
        var control = await CreateAsync();
        await _client.DeleteAsync(ControlRequests.PathOf(Id(control)));

        var response = await _client.PostAsync(RunRequests.RunsOf(Id(control)), null);

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.Conflict, "CONTROL_ARCHIVED");
        HttpAssert.JsonEqual($$"""{"id":{{Id(control)}} }""", problem.GetProperty("params").GetRawText());
        Assert.Empty(_engine.CallsTo(EngineStub.Run));
    }

    [Fact]
    public async Task Run_returns_404_control_not_found_when_no_control_has_the_id()
    {
        var response = await _client.PostAsync(RunRequests.RunsOf(int.MaxValue), null);

        await HttpAssert.ProblemAsync(response, HttpStatusCode.NotFound, "CONTROL_NOT_FOUND");
    }

    [Theory]
    [InlineData("\"2026-02-30\"")]
    [InlineData("\"01.11.2026\"")]
    [InlineData("\"2026-11-1\"")]
    [InlineData("\"\"")]
    [InlineData("20261101")]
    public async Task Run_returns_400_malformed_at_run_date_when_it_is_not_a_real_calendar_date(string runDate)
    {
        var control = await CreateAsync();

        var response = await _client.PostAsync(RunRequests.RunsOf(Id(control)), Body.Json($$"""{"runDate":{{runDate}} }"""));

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.BadRequest, "REQUEST_INVALID");
        HttpAssert.JsonEqual("""[{"path":"/runDate","code":"MALFORMED","params":{}}]""", HttpAssert.Errors(problem));
        Assert.Empty(_engine.CallsTo(EngineStub.Run));
    }

    [Theory]
    [InlineData("2026-11-10T21:59:59Z", "2026-11-10")]
    [InlineData("2026-11-10T22:30:00Z", "2026-11-11")]
    [InlineData("2026-07-10T20:59:59Z", "2026-07-10")]
    [InlineData("2026-07-10T21:00:00Z", "2026-07-11")]
    public async Task Run_date_is_today_in_jerusalem_when_the_request_names_none(string utcNow, string expectedDate)
    {
        var control = await CreateAsync();
        _engine.Answer(EngineStub.Run, HttpStatusCode.OK, RunAnswers.Numbered(0));
        fixture.Factory.Clock.Pin(DateTimeOffset.Parse(utcNow, System.Globalization.CultureInfo.InvariantCulture));

        var run = await RunRequests.StartAsync(_client, Id(control), "{}");

        Assert.Equal(expectedDate, run.GetProperty("runDate").GetString());
        using var sent = JsonDocument.Parse(Assert.Single(_engine.CallsTo(EngineStub.Run)).Body);
        Assert.Equal(expectedDate, sent.RootElement.GetProperty("runDate").GetString());
    }

    [Fact]
    public async Task Run_carries_the_previous_succeeded_run_and_the_history_is_newest_first()
    {
        var control = await CreateAsync();
        _engine.Answer(EngineStub.Run, HttpStatusCode.OK, RunAnswers.Numbered(4));
        var first = await RunRequests.StartAsync(_client, Id(control));
        _engine.Refuse(EngineStub.Run);
        var failed = await RunRequests.StartAsync(_client, Id(control));
        _engine.Answer(EngineStub.Run, HttpStatusCode.OK, RunAnswers.Numbered(2));
        var third = await RunRequests.StartAsync(_client, Id(control));

        var history = await (await _client.GetAsync($"{RunRequests.RunsOf(Id(control))}?pageSize=2")).ReadJsonAsync();
        var readThird = await (await _client.GetAsync(RunRequests.PathOf(Id(third)))).ReadJsonAsync();

        Assert.Equal(JsonValueKind.Null, first.GetProperty("previousRun").ValueKind);
        HttpAssert.JsonEqual(PreviousRun(first), failed.GetProperty("previousRun").GetRawText());
        HttpAssert.JsonEqual(PreviousRun(first), third.GetProperty("previousRun").GetRawText());
        HttpAssert.JsonEqual(third.GetRawText(), readThird.GetRawText());
        Assert.Equal([Id(third), Id(failed)], history.GetProperty("items").EnumerateArray().Select(Id));
        Assert.Equal((3, 1, 2), (history.GetProperty("total").GetInt32(), history.GetProperty("page").GetInt32(), history.GetProperty("pageSize").GetInt32()));
    }

    [Fact]
    public async Task Runs_started_in_the_same_millisecond_are_ordered_by_id_in_the_history_and_in_previous_run()
    {
        var control = await CreateAsync();
        _engine.Answer(EngineStub.Run, HttpStatusCode.OK, RunAnswers.Numbered(1));
        fixture.Factory.Clock.Pin(new DateTimeOffset(2026, 11, 10, 9, 0, 0, TimeSpan.Zero));

        var first = await RunRequests.StartAsync(_client, Id(control));
        var second = await RunRequests.StartAsync(_client, Id(control));
        var third = await RunRequests.StartAsync(_client, Id(control));
        var history = await (await _client.GetAsync(RunRequests.RunsOf(Id(control)))).ReadJsonAsync();
        var list = await ControlRequests.ListAsync(_client, _testId);

        Assert.Equal(first.GetProperty("startedAt").GetString(), third.GetProperty("startedAt").GetString());
        Assert.Equal([Id(third), Id(second), Id(first)], history.GetProperty("items").EnumerateArray().Select(Id));
        Assert.Equal(Id(first), second.GetProperty("previousRun").GetProperty("id").GetInt32());
        Assert.Equal(Id(second), third.GetProperty("previousRun").GetProperty("id").GetInt32());
        Assert.Equal(Id(third), list.GetProperty("items")[0].GetProperty("lastRun").GetProperty("id").GetInt32());
    }

    [Fact]
    public async Task Controls_list_shows_the_newest_run_of_any_status_as_last_run()
    {
        var control = await CreateAsync();
        _engine.Answer(EngineStub.Run, HttpStatusCode.OK, RunAnswers.Numbered(4));
        await RunRequests.StartAsync(_client, Id(control));
        _engine.Refuse(EngineStub.Run);
        var failed = await RunRequests.StartAsync(_client, Id(control));

        var item = Assert.Single((await ControlRequests.ListAsync(_client, _testId)).GetProperty("items").EnumerateArray());

        HttpAssert.JsonEqual(
            $$"""{"id":{{Id(failed)}},"startedAt":{{failed.GetProperty("startedAt").GetRawText()}},"status":"failed","totalCount":null}""",
            item.GetProperty("lastRun").GetRawText());
    }

    [Fact]
    public async Task Run_and_history_return_404_naming_what_is_missing()
    {
        var noRun = await _client.GetAsync(RunRequests.PathOf(int.MaxValue));
        var noResults = await _client.GetAsync($"{RunRequests.PathOf(int.MaxValue)}/results");
        var noControl = await _client.GetAsync(RunRequests.RunsOf(int.MaxValue));

        var problem = await HttpAssert.ProblemAsync(noRun, HttpStatusCode.NotFound, "RUN_NOT_FOUND");
        HttpAssert.JsonEqual($$"""{"id":{{int.MaxValue}} }""", problem.GetProperty("params").GetRawText());
        await HttpAssert.ProblemAsync(noResults, HttpStatusCode.NotFound, "RUN_NOT_FOUND");
        await HttpAssert.ProblemAsync(noControl, HttpStatusCode.NotFound, "CONTROL_NOT_FOUND");
    }

    private Task<JsonElement> CreateAsync() => ControlRequests.CreateAsync(_client, TestData.Name(_testId));

    private async Task<JsonElement> RunWithEngineAnswerAsync(HttpStatusCode status, string body)
    {
        var control = await CreateAsync();
        _engine.Answer(EngineStub.Run, status, body);
        return await RunRequests.StartAsync(_client, Id(control));
    }

    /// <summary>A run that did not succeed: its status and code, no counts, no sentence, an elapsed time of its own.</summary>
    private static void AssertClosed(JsonElement run, string status, string code)
    {
        Assert.Equal(status, run.GetProperty("status").GetString());
        Assert.Equal(code, run.GetProperty("error").GetProperty("code").GetString());
        Assert.Matches(Timestamp, run.GetProperty("finishedAt").GetString());
        Assert.True(run.GetProperty("durationMs").GetInt32() >= 0);
        Assert.False(run.GetProperty("capExceeded").GetBoolean());
        foreach (var member in new[] { "totalCount", "storedCount", "sentence", "sentenceParts", "conditions" })
        {
            Assert.Equal(JsonValueKind.Null, run.GetProperty(member).ValueKind);
        }
    }

    private static string PreviousRun(JsonElement run) =>
        $$"""{"id":{{Id(run)}},"startedAt":{{run.GetProperty("startedAt").GetRawText()}},"totalCount":{{run.GetProperty("totalCount").GetInt32()}} }""";

    private static int Id(JsonElement element) => element.GetProperty("id").GetInt32();
}
