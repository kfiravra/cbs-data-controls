using System.Diagnostics;
using System.Net;
using DataControls.Api.Tests.Support;

namespace DataControls.Api.Tests.Engine;

/// <summary>
/// The engine client and its resilience pipeline, seen from a request: how many calls reach the engine
/// for each kind of failure, and what the client is told.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class EngineCallTests(ApiFixture fixture)
{
    private readonly HttpClient _client = fixture.CreateClient();
    private readonly EngineStub _engine = fixture.Factory.Engine;

    [Fact]
    public async Task Validate_returns_503_engine_unavailable_after_two_calls_when_the_connection_is_refused()
    {
        _engine.Refuse(EngineStub.Validate);

        var response = await ValidateAsync();

        await HttpAssert.ProblemAsync(response, HttpStatusCode.ServiceUnavailable, "ENGINE_UNAVAILABLE");
        Assert.Equal(2, _engine.CallsTo(EngineStub.Validate).Count);
    }

    [Fact]
    public async Task Validate_returns_503_database_unavailable_after_two_calls_when_the_engine_answers_503()
    {
        _engine.Answer(EngineStub.Validate, HttpStatusCode.ServiceUnavailable, EngineFixtures.Read("problem-database-unavailable.json"));

        var response = await ValidateAsync();

        await HttpAssert.ProblemAsync(response, HttpStatusCode.ServiceUnavailable, "DATABASE_UNAVAILABLE");
        Assert.Equal(2, _engine.CallsTo(EngineStub.Validate).Count);
    }

    [Fact]
    public async Task Validate_returns_504_with_the_timeout_after_one_call_when_the_engine_answers_504()
    {
        _engine.Answer(EngineStub.Validate, HttpStatusCode.GatewayTimeout, EngineFixtures.Read("problem-query-timeout.json"));

        var response = await ValidateAsync();

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.GatewayTimeout, "QUERY_TIMEOUT");
        HttpAssert.JsonEqual("""{"timeoutSeconds":30}""", problem.GetProperty("params").GetRawText());
        Assert.Single(_engine.CallsTo(EngineStub.Validate));
    }

    [Fact]
    public async Task Validate_returns_422_with_the_engine_errors_after_one_call_when_the_engine_answers_422()
    {
        var engineProblem = EngineFixtures.Read("problem-definition-invalid.json");
        _engine.Answer(EngineStub.Validate, HttpStatusCode.UnprocessableEntity, engineProblem);

        var response = await ValidateAsync();

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.UnprocessableEntity, "DEFINITION_INVALID");
        using var expected = System.Text.Json.JsonDocument.Parse(engineProblem);
        HttpAssert.JsonEqual(expected.RootElement.GetProperty("errors").GetRawText(), HttpAssert.Errors(problem));
        Assert.Single(_engine.CallsTo(EngineStub.Validate));
    }

    [Theory]
    [InlineData(HttpStatusCode.InternalServerError, 1)]
    [InlineData(HttpStatusCode.BadRequest, 1)]
    [InlineData(HttpStatusCode.BadGateway, 2)]
    public async Task Validate_returns_500_internal_error_when_the_engine_answers_anything_else(HttpStatusCode engineStatus, int expectedCalls)
    {
        _engine.Answer(EngineStub.Validate, engineStatus, EngineFixtures.Problem("INTERNAL_ERROR", (int)engineStatus));

        var response = await ValidateAsync();

        await HttpAssert.ProblemAsync(response, HttpStatusCode.InternalServerError, "INTERNAL_ERROR");
        Assert.Equal(expectedCalls, _engine.CallsTo(EngineStub.Validate).Count);
    }

    [Theory]
    [InlineData("[]")]
    [InlineData("not json")]
    public async Task Validate_returns_500_internal_error_when_the_engine_succeeds_with_a_body_outside_the_contract(string body)
    {
        _engine.Answer(EngineStub.Validate, HttpStatusCode.OK, body);

        var response = await ValidateAsync();

        await HttpAssert.ProblemAsync(response, HttpStatusCode.InternalServerError, "INTERNAL_ERROR");
    }

    [Fact]
    public async Task Validate_returns_503_engine_unavailable_after_one_call_when_the_attempt_times_out()
    {
        _engine.Delay(EngineStub.Validate, TimeSpan.FromSeconds(30));
        var watch = Stopwatch.StartNew();

        var response = await ValidateAsync();

        await HttpAssert.ProblemAsync(response, HttpStatusCode.ServiceUnavailable, "ENGINE_UNAVAILABLE");
        Assert.Single(_engine.CallsTo(EngineStub.Validate));
        Assert.InRange(watch.Elapsed, TimeSpan.FromMilliseconds(400), TimeSpan.FromSeconds(10));
    }

    [Fact]
    public async Task Validate_returns_503_engine_unavailable_within_one_more_attempt_timeout_when_the_body_never_arrives()
    {
        _engine.StallBody(EngineStub.Validate);
        var watch = Stopwatch.StartNew();

        var response = await ValidateAsync();

        await HttpAssert.ProblemAsync(response, HttpStatusCode.ServiceUnavailable, "ENGINE_UNAVAILABLE");
        Assert.Single(_engine.CallsTo(EngineStub.Validate));
        Assert.InRange(watch.Elapsed, TimeSpan.FromMilliseconds(400), TimeSpan.FromSeconds(10));
    }

    [Fact]
    public async Task Engine_call_carries_the_request_correlation_id_and_the_resolved_language()
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/controls/validate")
        {
            Content = Body.Definition(Examples.Definition(Examples.First)),
        };
        request.Headers.Add("X-Correlation-Id", "forward-me-7");
        request.Headers.TryAddWithoutValidation("Accept-Language", "en-US,en;q=0.8");

        await _client.SendAsync(request);

        var call = Assert.Single(_engine.CallsTo(EngineStub.Validate));
        Assert.Equal("forward-me-7", call.Headers["X-Correlation-Id"]);
        Assert.Equal("he", call.Headers["Accept-Language"]);
    }

    [Fact]
    public async Task Engine_call_sends_the_definition_as_the_only_member_of_the_body()
    {
        var definition = Examples.Definition(Examples.First);

        await ValidateAsync();

        var call = Assert.Single(_engine.CallsTo(EngineStub.Validate));
        HttpAssert.JsonEqual($$"""{"definition":{{definition}}}""", call.Body);
    }

    private Task<HttpResponseMessage> ValidateAsync() =>
        _client.PostAsync("/api/v1/controls/validate", Body.Definition(Examples.Definition(Examples.First)));
}
