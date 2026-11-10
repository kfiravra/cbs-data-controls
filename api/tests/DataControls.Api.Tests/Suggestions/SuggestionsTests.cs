using System.Net;
using System.Text.Json;
using DataControls.Api.Tests.Support;

namespace DataControls.Api.Tests.Suggestions;

[Collection(ApiCollection.Name)]
public sealed class SuggestionsTests(ApiFixture fixture)
{
    private const string Path = "/api/v1/suggestions";
    private const string AcceptPath = "/api/v1/suggestions/accept";

    private readonly HttpClient _client = fixture.CreateClient();
    private readonly EngineStub _engine = fixture.Factory.Engine;
    private readonly string _testId = TestData.NewTestId();

    [Fact]
    public async Task Suggestions_return_the_engine_body_byte_for_byte_and_send_it_exactly_the_two_members()
    {
        var request = new HttpRequestMessage(HttpMethod.Post, Path) { Content = Body.Json("""{"rootEntity":"employee","max":5,"somethingElse":true}""") };
        request.Headers.TryAddWithoutValidation("Accept-Language", "en");

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(EngineFixtures.ReadBytes("suggest.json"), await response.Content.ReadAsByteArrayAsync());
        var call = Assert.Single(_engine.CallsTo(EngineStub.Suggest));
        HttpAssert.JsonEqual("""{"rootEntity":"employee","max":5}""", call.Body);
        Assert.Equal("he", call.Headers["Accept-Language"]);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("{}")]
    [InlineData("""{"rootEntity":null,"max":null}""")]
    public async Task Suggestions_send_the_engine_an_empty_object_when_nothing_is_asked_for(string? body)
    {
        var response = await _client.PostAsync(Path, body is null ? null : Body.Json(body));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("{}", Assert.Single(_engine.CallsTo(EngineStub.Suggest)).Body);
    }

    [Theory]
    [InlineData("""{"max":0}""", """[{"path":"/max","code":"OUT_OF_RANGE","params":{"min":1}}]""")]
    [InlineData("""{"max":"5"}""", """[{"path":"/max","code":"MALFORMED","params":{}}]""")]
    [InlineData("""{"max":1.5}""", """[{"path":"/max","code":"MALFORMED","params":{}}]""")]
    [InlineData("""{"rootEntity":7}""", """[{"path":"/rootEntity","code":"MALFORMED","params":{}}]""")]
    public async Task Suggestions_return_400_and_do_not_ask_the_engine_when_a_member_is_wrong(string body, string expectedErrors)
    {
        var response = await _client.PostAsync(Path, Body.Json(body));

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.BadRequest, "REQUEST_INVALID");
        HttpAssert.JsonEqual(expectedErrors, HttpAssert.Errors(problem));
        Assert.Empty(_engine.Calls);
    }

    [Theory]
    [InlineData(HttpStatusCode.ServiceUnavailable, "problem-database-unavailable.json", "DATABASE_UNAVAILABLE")]
    [InlineData(HttpStatusCode.GatewayTimeout, "problem-query-timeout.json", "QUERY_TIMEOUT")]
    public async Task Suggestions_relay_the_engine_problem_when_the_engine_cannot_compute_them(HttpStatusCode status, string fixtureName, string code)
    {
        _engine.Answer(EngineStub.Suggest, status, EngineFixtures.Read(fixtureName));

        var response = await _client.PostAsync(Path, null);

        await HttpAssert.ProblemAsync(response, status, code);
    }

    [Fact]
    public async Task Suggestions_return_503_engine_unavailable_when_the_engine_is_down()
    {
        _engine.RefuseEverything();

        var response = await _client.PostAsync(Path, null);

        await HttpAssert.ProblemAsync(response, HttpStatusCode.ServiceUnavailable, "ENGINE_UNAVAILABLE");
    }

    [Fact]
    public async Task Accept_returns_201_with_every_control_in_order_and_the_location_of_the_first()
    {
        var first = Examples.Definition(Examples.First);
        var second = Examples.Definition("termination-before-hire");

        var response = await _client.PostAsync(AcceptPath, Items(Item("first", first, "described"), Item("second", second)));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var items = (await response.ReadJsonAsync()).GetProperty("items").EnumerateArray().ToList();
        Assert.Equal(2, items.Count);
        Assert.Equal(ControlRequests.PathOf(items[0].GetProperty("id").GetInt32()), response.Headers.Location?.OriginalString);
        Assert.Equal([TestData.Name(_testId, "first"), TestData.Name(_testId, "second")], items.Select(item => item.GetProperty("name").GetString()));
        Assert.Equal("described", items[0].GetProperty("description").GetString());
        Assert.All(items, item => Assert.Equal(1, item.GetProperty("version").GetInt32()));
        HttpAssert.JsonEqual(second, items[1].GetProperty("definition").GetRawText());
        Assert.Equal(2, _engine.CallsTo(EngineStub.Validate).Count);
        Assert.Equal(2, (await ControlRequests.ListAsync(_client, _testId)).GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task Accept_creates_nothing_and_names_the_index_when_the_schema_rejects_the_second_item()
    {
        var invalid = Examples.Invalid("between-with-one-value");

        var response = await _client.PostAsync(
            AcceptPath,
            Items(Item("good", Examples.Definition(Examples.First)), Item("bad", invalid.GetProperty("definition").GetRawText()), Item("never reached", "{}")));

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.UnprocessableEntity, "DEFINITION_INVALID");
        HttpAssert.JsonEqual("""{"index":1}""", problem.GetProperty("params").GetRawText());
        var error = Assert.Single(problem.GetProperty("errors").EnumerateArray());
        Assert.Equal(invalid.GetProperty("expected").GetProperty("path").GetString(), error.GetProperty("path").GetString());
        Assert.Equal(0, (await ControlRequests.ListAsync(_client, _testId, "&active=all")).GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task Accept_creates_nothing_and_names_the_index_when_the_engine_rejects_the_second_item()
    {
        var engineProblem = EngineFixtures.Read("problem-definition-invalid.json");
        var calls = 0;
        _engine.Respond(EngineStub.Validate, _ => ++calls == 2
            ? EngineStub.Json(HttpStatusCode.UnprocessableEntity, engineProblem)
            : EngineStub.Json(HttpStatusCode.OK, EngineFixtures.Read("validate.json")));

        var response = await _client.PostAsync(
            AcceptPath,
            Items(Item("good", Examples.Definition(Examples.First)), Item("rejected", Examples.Invalid("unknown-field").GetProperty("definition").GetRawText())));

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.UnprocessableEntity, "DEFINITION_INVALID");
        HttpAssert.JsonEqual("""{"index":1}""", problem.GetProperty("params").GetRawText());
        using var expected = JsonDocument.Parse(engineProblem);
        HttpAssert.JsonEqual(expected.RootElement.GetProperty("errors").GetRawText(), HttpAssert.Errors(problem));
        Assert.Equal(0, (await ControlRequests.ListAsync(_client, _testId, "&active=all")).GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task Accept_creates_nothing_when_the_engine_goes_down_after_the_first_item()
    {
        var calls = 0;
        _engine.Respond(EngineStub.Validate, _ => ++calls == 1
            ? EngineStub.Json(HttpStatusCode.OK, EngineFixtures.Read("validate.json"))
            : throw new HttpRequestException("refused"));

        var response = await _client.PostAsync(
            AcceptPath,
            Items(Item("good", Examples.Definition(Examples.First)), Item("unlucky", Examples.Definition(Examples.First))));

        await HttpAssert.ProblemAsync(response, HttpStatusCode.ServiceUnavailable, "ENGINE_UNAVAILABLE");
        Assert.Equal(0, (await ControlRequests.ListAsync(_client, _testId, "&active=all")).GetProperty("total").GetInt32());
    }

    [Theory]
    [InlineData("{}", """[{"path":"/items","code":"REQUIRED","params":{}}]""")]
    [InlineData("", """[{"path":"/items","code":"REQUIRED","params":{}}]""")]
    [InlineData("""{"items":[]}""", """[{"path":"/items","code":"OUT_OF_RANGE","params":{"min":1,"max":20}}]""")]
    [InlineData("""{"items":{}}""", """[{"path":"/items","code":"MALFORMED","params":{}}]""")]
    [InlineData("""{"items":[null,{"name":"  ","definition":[]}]}""", """[{"path":"/items/0/name","code":"REQUIRED","params":{}},{"path":"/items/0/definition","code":"REQUIRED","params":{}},{"path":"/items/1/name","code":"REQUIRED","params":{}},{"path":"/items/1/definition","code":"MALFORMED","params":{}}]""")]
    public async Task Accept_returns_400_pointing_into_the_items_when_the_request_is_wrong(string body, string expectedErrors)
    {
        var response = await _client.PostAsync(AcceptPath, Body.Json(body));

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.BadRequest, "REQUEST_INVALID");
        HttpAssert.JsonEqual(expectedErrors, HttpAssert.Errors(problem));
        Assert.Empty(_engine.Calls);
    }

    [Fact]
    public async Task Accept_returns_400_out_of_range_when_more_than_20_items_are_sent()
    {
        var items = Enumerable.Range(0, 21).Select(index => Item($"item {index}", Examples.Definition(Examples.First))).ToArray();

        var response = await _client.PostAsync(AcceptPath, Items(items));

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.BadRequest, "REQUEST_INVALID");
        HttpAssert.JsonEqual("""[{"path":"/items","code":"OUT_OF_RANGE","params":{"min":1,"max":20}}]""", HttpAssert.Errors(problem));
    }

    private string Item(string label, string definitionJson, string? description = null)
    {
        var descriptionMember = description is null ? string.Empty : $",\"description\":{JsonSerializer.Serialize(description)}";
        return $"{{\"name\":{JsonSerializer.Serialize(TestData.Name(_testId, label))}{descriptionMember},\"definition\":{definitionJson}}}";
    }

    private static StringContent Items(params string[] items) => Body.Json($"{{\"items\":[{string.Join(',', items)}]}}");
}
