using System.Net;
using System.Net.Http.Headers;
using System.Text;
using DataControls.Api.Tests.Support;

namespace DataControls.Api.Tests.Errors;

[Collection(ApiCollection.Name)]
public sealed class ProblemShapeTests(ApiFixture fixture)
{
    private readonly HttpClient _client = fixture.CreateClient();

    [Fact]
    public async Task Unknown_api_path_returns_404_with_exactly_the_problem_members()
    {
        var response = await _client.GetAsync("/api/v1/no-such-thing");

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.NotFound, "NOT_FOUND");
        var correlationId = Assert.Single(response.Headers.GetValues("X-Correlation-Id"));
        HttpAssert.JsonEqual(
            $$"""{"type":"about:blank","title":"NOT_FOUND","status":404,"code":"NOT_FOUND","params":{},"correlationId":"{{correlationId}}"}""",
            problem.GetRawText());
    }

    [Fact]
    public async Task Known_path_returns_404_when_the_method_is_not_served()
    {
        var response = await _client.DeleteAsync("/api/v1/health");

        await HttpAssert.ProblemAsync(response, HttpStatusCode.NotFound, "NOT_FOUND");
    }

    [Theory]
    [InlineData("this is not json")]
    [InlineData("""{"name":"cut off""")]
    [InlineData("""{"name":"x",}""")]
    public async Task Body_returns_415_without_errors_when_it_is_sent_as_json_and_its_text_is_not_json(string body)
    {
        var response = await _client.PostAsync("/_probe/items", Body.Json(body));

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.UnsupportedMediaType, "REQUEST_INVALID");
        Assert.False(problem.TryGetProperty("errors", out _));
    }

    [Theory]
    [InlineData("[]")]
    [InlineData("5")]
    public async Task Body_returns_400_malformed_at_the_root_when_it_is_json_but_not_an_object(string body)
    {
        var response = await _client.PostAsync("/_probe/items", Body.Json(body));

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.BadRequest, "REQUEST_INVALID");
        HttpAssert.JsonEqual("""[{"path":"","code":"MALFORMED","params":{}}]""", HttpAssert.Errors(problem));
    }

    [Theory]
    [InlineData("""{"name":5}""")]
    [InlineData("""{"name":["a"]}""")]
    public async Task Member_returns_400_malformed_at_its_pointer_when_it_has_the_wrong_json_type(string body)
    {
        var response = await _client.PostAsync("/_probe/items", Body.Json(body));

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.BadRequest, "REQUEST_INVALID");
        HttpAssert.JsonEqual("""[{"path":"/name","code":"MALFORMED","params":{}}]""", HttpAssert.Errors(problem));
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("""{"name":null}""")]
    [InlineData("""{"name":"   "}""")]
    [InlineData("""{"Name":"wrong case is an unknown member"}""")]
    [InlineData("null")]
    [InlineData("")]
    public async Task Required_member_returns_400_required_when_it_is_missing_null_or_blank(string body)
    {
        var response = await _client.PostAsync("/_probe/items", Body.Json(body));

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.BadRequest, "REQUEST_INVALID");
        HttpAssert.JsonEqual("""[{"path":"/name","code":"REQUIRED","params":{}}]""", HttpAssert.Errors(problem));
    }

    [Fact]
    public async Task Request_lists_every_fault_when_two_members_are_too_long_after_trimming()
    {
        var response = await _client.PostAsync(
            "/_probe/items",
            Body.Json("""{"name":"  abcdefghijk  ","note":"abcdefghijkl"}"""));

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.BadRequest, "REQUEST_INVALID");
        HttpAssert.JsonEqual(
            $$"""[{"path":"/name","code":"TOO_LONG","params":{"max":{{ProbeController.MaxNameLength}} } },{"path":"/note","code":"TOO_LONG","params":{"max":{{ProbeController.MaxNameLength}} } }]""",
            HttpAssert.Errors(problem));
    }

    [Fact]
    public async Task Member_comes_back_trimmed_and_in_hebrew_when_the_body_also_has_an_unknown_member()
    {
        var hebrew = TestData.HebrewText[..ProbeController.MaxNameLength].Trim();

        var response = await _client.PostAsync("/_probe/items", Body.Json($$"""{"name":"  {{hebrew}}  ","extra":true}"""));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal($$"""{"name":"{{hebrew}}","note":null}""", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Query_parameter_returns_400_malformed_under_its_name_when_it_is_not_an_integer()
    {
        var response = await _client.GetAsync("/_probe/items?page=abc");

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.BadRequest, "REQUEST_INVALID");
        HttpAssert.JsonEqual("""[{"path":"page","code":"MALFORMED","params":{}}]""", HttpAssert.Errors(problem));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(51)]
    public async Task Query_parameter_returns_400_out_of_range_with_its_bounds(int page)
    {
        var response = await _client.GetAsync($"/_probe/items?page={page}");

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.BadRequest, "REQUEST_INVALID");
        HttpAssert.JsonEqual(
            $$"""[{"path":"page","code":"OUT_OF_RANGE","params":{"min":{{ProbeController.MinPage}},"max":{{ProbeController.MaxPage}} } }]""",
            HttpAssert.Errors(problem));
    }

    [Fact]
    public async Task Body_returns_415_without_errors_when_its_media_type_is_not_json()
    {
        var response = await _client.PostAsync("/_probe/items", new StringContent("name=x", Encoding.UTF8, "text/plain"));

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.UnsupportedMediaType, "REQUEST_INVALID");
        Assert.False(problem.TryGetProperty("errors", out _));
    }

    [Fact]
    public async Task Body_returns_413_without_errors_when_its_declared_length_is_over_one_megabyte()
    {
        var oversized = $$"""{"name":"{{new string('a', 1024 * 1024)}}"}""";

        var response = await _client.PostAsync("/_probe/items", Body.Json(oversized));

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.RequestEntityTooLarge, "REQUEST_INVALID");
        Assert.False(problem.TryGetProperty("errors", out _));
    }

    [Fact]
    public async Task Body_returns_413_without_errors_when_it_is_over_one_megabyte_and_declares_no_length()
    {
        var content = new StreamContent(new MemoryStream(Encoding.UTF8.GetBytes($$"""{"name":"{{new string('a', 1024 * 1024)}}"}""")));
        content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
        var request = new HttpRequestMessage(HttpMethod.Post, "/_probe/items") { Content = content };
        request.Headers.TransferEncodingChunked = true;

        var response = await _client.SendAsync(request);

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.RequestEntityTooLarge, "REQUEST_INVALID");
        Assert.False(problem.TryGetProperty("errors", out _));
    }

    [Fact]
    public async Task Unhandled_failure_returns_500_and_nothing_of_the_exception()
    {
        var response = await _client.GetAsync("/_probe/failure");

        var body = await response.Content.ReadAsStringAsync();
        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.InternalServerError, "INTERNAL_ERROR");
        Assert.DoesNotContain(ProbeController.Secret, body);
        Assert.DoesNotContain("Exception", body);
        Assert.Equal(6, problem.EnumerateObject().Count());
    }
}
