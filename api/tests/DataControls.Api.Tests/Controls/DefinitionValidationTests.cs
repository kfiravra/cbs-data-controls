using System.Net;
using DataControls.Api.Tests.Support;

namespace DataControls.Api.Tests.Controls;

/// <summary>
/// <c>POST /api/v1/controls/validate</c>: the api's own layer answers from the schema without the engine,
/// and the engine's layer is relayed. Expected codes and paths come from <c>contracts/examples/invalid/</c>.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class DefinitionValidationTests(ApiFixture fixture)
{
    private const string Path = "/api/v1/controls/validate";

    private readonly HttpClient _client = fixture.CreateClient();
    private readonly EngineStub _engine = fixture.Factory.Engine;

    public static TheoryData<string> SchemaLayerFixtures => Examples.InvalidOf("schema");

    public static TheoryData<string> SemanticLayerFixtures => Examples.InvalidOf("semantic");

    public static TheoryData<string> ExampleIds => Examples.Ids;

    [Theory]
    [MemberData(nameof(SchemaLayerFixtures))]
    public async Task Validate_returns_422_with_the_fixture_code_and_path_and_no_engine_call_when_the_schema_fails(string fixtureName)
    {
        var invalid = Examples.Invalid(fixtureName);
        var expected = invalid.GetProperty("expected");

        var response = await _client.PostAsync(Path, Body.Definition(invalid.GetProperty("definition").GetRawText()));

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.UnprocessableEntity, "DEFINITION_INVALID");
        var error = Assert.Single(problem.GetProperty("errors").EnumerateArray());
        Assert.Equal(expected.GetProperty("code").GetString(), error.GetProperty("code").GetString());
        Assert.Equal(expected.GetProperty("path").GetString(), error.GetProperty("path").GetString());
        Assert.Equal("{}", error.GetProperty("params").GetRawText());
        Assert.Equal("{}", problem.GetProperty("params").GetRawText());
        Assert.Empty(_engine.Calls);
    }

    [Theory]
    [MemberData(nameof(SemanticLayerFixtures))]
    public async Task Validate_relays_the_engine_code_and_path_unchanged_when_the_schema_passes_and_the_engine_rejects(string fixtureName)
    {
        var invalid = Examples.Invalid(fixtureName);
        var expected = invalid.GetProperty("expected");
        var engineErrors = $$"""[{"code":{{expected.GetProperty("code").GetRawText()}},"path":{{expected.GetProperty("path").GetRawText()}},"nodeId":"c1","params":{"entity":"employee","index":0} }]""";
        _engine.Answer(EngineStub.Validate, HttpStatusCode.UnprocessableEntity, EngineFixtures.Problem("DEFINITION_INVALID", 422, errors: engineErrors));

        var response = await _client.PostAsync(Path, Body.Definition(invalid.GetProperty("definition").GetRawText()));

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.UnprocessableEntity, "DEFINITION_INVALID");
        HttpAssert.JsonEqual(engineErrors, HttpAssert.Errors(problem));
        Assert.Single(_engine.CallsTo(EngineStub.Validate));
    }

    [Theory]
    [MemberData(nameof(ExampleIds))]
    public async Task Validate_passes_the_schema_and_asks_the_engine_once_when_the_definition_is_an_example(string exampleId)
    {
        var response = await _client.PostAsync(Path, Body.Definition(Examples.Definition(exampleId)));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Single(_engine.CallsTo(EngineStub.Validate));
    }

    [Fact]
    public async Task Validate_returns_the_engine_body_byte_for_byte_when_the_definition_is_valid()
    {
        var response = await _client.PostAsync(Path, Body.Definition(Examples.Definition(Examples.First)));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal(EngineFixtures.ReadBytes("validate.json"), await response.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task Validate_lists_two_errors_in_document_order_when_the_later_member_is_checked_first_by_the_schema()
    {
        // `op` is written after `children`, so the child's fault comes first in the text.
        const string definition = """
            {"schemaVersion":1,"rootEntity":"employee","where":{"type":"group","children":[
              {"type":"condition","id":"c1","left":{"field":"age"},"operator":"lt","value":18},
              {"type":"condition","id":"c2","left":{"field":"salary"}}],"op":"xor"}}
            """;

        var response = await _client.PostAsync(Path, Body.Definition(definition));

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.UnprocessableEntity, "DEFINITION_INVALID");
        HttpAssert.JsonEqual(
            """[{"code":"SCHEMA_VIOLATION","path":"/where/children/1","nodeId":"c2","params":{}},{"code":"SCHEMA_VIOLATION","path":"/where/op","params":{}}]""",
            HttpAssert.Errors(problem));
        Assert.Empty(_engine.Calls);
    }

    [Fact]
    public async Task Validate_names_the_nearest_node_when_the_fault_is_inside_a_related_node()
    {
        const string definition = """
            {"schemaVersion":1,"rootEntity":"department","where":{"type":"group","op":"and","children":[
              {"type":"related","id":"r1","relationship":"department.employees","quantifier":"none","where":{"type":"group","op":"both","children":[
                {"type":"condition","id":"c2","left":{"field":"status","oops":true},"operator":"eq","value":"active"}]}}]}}
            """;

        var response = await _client.PostAsync(Path, Body.Definition(definition));

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.UnprocessableEntity, "DEFINITION_INVALID");
        HttpAssert.JsonEqual(
            """[{"code":"SCHEMA_VIOLATION","path":"/where/children/0/where/op","nodeId":"r1","params":{}},{"code":"SCHEMA_VIOLATION","path":"/where/children/0/where/children/0/left","nodeId":"c2","params":{}}]""",
            HttpAssert.Errors(problem));
    }

    [Theory]
    [InlineData("2")]
    [InlineData("\"1\"")]
    [InlineData("null")]
    public async Task Validate_returns_only_unsupported_schema_version_when_the_version_is_present_and_not_the_number_1(string version)
    {
        var definition = $$"""{"schemaVersion":{{version}},"rootEntity":5,"unknown":true}""";

        var response = await _client.PostAsync(Path, Body.Definition(definition));

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.UnprocessableEntity, "DEFINITION_INVALID");
        HttpAssert.JsonEqual("""[{"code":"UNSUPPORTED_SCHEMA_VERSION","path":"/schemaVersion","params":{}}]""", HttpAssert.Errors(problem));
        Assert.Empty(_engine.Calls);
    }

    [Fact]
    public async Task Validate_reports_the_missing_version_through_the_schema_when_the_definition_has_none()
    {
        var response = await _client.PostAsync(Path, Body.Definition("""{"rootEntity":"employee"}"""));

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.UnprocessableEntity, "DEFINITION_INVALID");
        HttpAssert.JsonEqual("""[{"code":"SCHEMA_VIOLATION","path":"","params":{}}]""", HttpAssert.Errors(problem));
    }

    [Theory]
    [InlineData("{}", "REQUIRED")]
    [InlineData("""{"definition":null}""", "REQUIRED")]
    [InlineData("""{"definition":[]}""", "MALFORMED")]
    [InlineData("""{"definition":"text"}""", "MALFORMED")]
    [InlineData("", "REQUIRED")]
    public async Task Validate_returns_400_at_the_definition_member_when_it_is_missing_or_not_an_object(string body, string code)
    {
        var response = await _client.PostAsync(Path, Body.Json(body));

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.BadRequest, "REQUEST_INVALID");
        HttpAssert.JsonEqual($$"""[{"path":"/definition","code":"{{code}}","params":{} }]""", HttpAssert.Errors(problem));
        Assert.Empty(_engine.Calls);
    }

    [Theory]
    [InlineData("""{"schemaVersion":1,"rootEntity":"employee","where":{"type":"group","op":"and","children":[{"type":"condition","id":"c1","left":{"field":"status"},"operator":"eq","value":"<half>"}]}}""")]
    [InlineData("""{"schemaVersion":1,"rootEntity":"employee","where":{"type":"group","op":"and","children":[{"type":"condition","id":"c<half>","left":{"field":"status"},"operator":"eq","value":"active"}]}}""")]
    [InlineData("""{"schemaVersion":1,"rootEntity":"<half>","where":{"type":"group","op":"and","children":[]}}""")]
    public async Task Validate_returns_400_malformed_and_no_engine_call_when_a_string_of_the_definition_holds_half_a_surrogate_pair(string template)
    {
        // The JSON escape of the first half of a surrogate pair: a backslash, then "ud83d".
        var definition = template.Replace("<half>", @"\" + "ud83d");

        var response = await _client.PostAsync(Path, Body.Definition(definition));

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.BadRequest, "REQUEST_INVALID");
        HttpAssert.JsonEqual("""[{"path":"","code":"MALFORMED","params":{}}]""", HttpAssert.Errors(problem));
        Assert.Empty(_engine.Calls);
    }

    [Fact]
    public async Task Validate_sends_the_definition_text_as_it_came_when_a_writer_would_escape_its_strings()
    {
        // The engine refuses a body over its own limit; "+" written as an escape is six bytes for one.
        var value = "a+b <c> & 'd' " + char.ConvertFromUtf32(0x1F600);
        var definition = $$"""{"schemaVersion":1,"rootEntity":"employee","where":{"type":"group","op":"and","children":[{"type":"condition","id":"c1","left":{"field":"status"},"operator":"eq","value":"{{value}}"}]} }""";

        var response = await _client.PostAsync(Path, Body.Definition(definition));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var call = Assert.Single(_engine.CallsTo(EngineStub.Validate));
        Assert.Equal("{\"definition\":" + definition + "}", call.Body);
    }

    [Fact]
    public async Task Validate_returns_one_error_at_the_root_and_stays_cheap_when_a_long_unknown_member_name_holds_a_wide_array()
    {
        // Within what this layer evaluates. A pointer for every element of it would be 9,000 pointers of
        // 50,000 characters: 900 MB.
        var definition = $$"""{"schemaVersion":1,"{{new string('a', 50_000)}}":[{{string.Join(',', Enumerable.Repeat("0", 9_000))}}]}""";
        var before = GC.GetTotalAllocatedBytes();

        var response = await _client.PostAsync(Path, Body.Definition(definition));

        var allocated = GC.GetTotalAllocatedBytes() - before;
        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.UnprocessableEntity, "DEFINITION_INVALID");
        HttpAssert.JsonEqual("""[{"code":"SCHEMA_VIOLATION","path":"","params":{}}]""", HttpAssert.Errors(problem));
        Assert.InRange(allocated, 0, 200L * 1024 * 1024);
        Assert.Empty(_engine.Calls);
    }

    [Fact]
    public async Task Validate_lists_every_child_itself_when_the_tree_has_as_many_nodes_as_this_layer_evaluates()
    {
        var response = await _client.PostAsync(Path, Body.Definition(GroupOf(Enumerable.Repeat("{}", 240))));

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.UnprocessableEntity, "DEFINITION_INVALID");
        var paths = problem.GetProperty("errors").EnumerateArray().Select(error => error.GetProperty("path").GetString()).ToList();
        Assert.Equal(241, paths.Count);
        Assert.Equal(["/where/children", "/where/children/0", "/where/children/1"], paths.Take(3));
        Assert.Equal("/where/children/239", paths[^1]);
        Assert.Empty(_engine.Calls);
    }

    [Theory]
    [InlineData(241)]
    [InlineData(50_000)]
    public async Task Validate_leaves_the_definition_to_the_engine_and_stays_cheap_when_the_tree_has_more_nodes_than_this_layer_evaluates(int children)
    {
        // The schema library spends about half a millisecond and 50 KB on each empty child: 23 s and 2.4 GB for 50,000.
        var engineErrors = """[{"code":"TOO_MANY_CONDITIONS","path":"/where","params":{"max":30}}]""";
        _engine.Answer(EngineStub.Validate, HttpStatusCode.UnprocessableEntity, EngineFixtures.Problem("DEFINITION_INVALID", 422, errors: engineErrors));
        var before = GC.GetTotalAllocatedBytes();

        var response = await _client.PostAsync(Path, Body.Definition(GroupOf(Enumerable.Repeat("{}", children))));

        var allocated = GC.GetTotalAllocatedBytes() - before;
        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.UnprocessableEntity, "DEFINITION_INVALID");
        HttpAssert.JsonEqual(engineErrors, HttpAssert.Errors(problem));
        Assert.Single(_engine.CallsTo(EngineStub.Validate));
        Assert.InRange(allocated, 0, 200L * 1024 * 1024);
    }

    [Fact]
    public async Task Validate_leaves_the_definition_to_the_engine_when_it_holds_more_values_than_this_layer_evaluates()
    {
        var condition = $$"""{"type":"condition","id":"c1","left":{"field":"age"},"operator":"in","values":[{{string.Join(',', Enumerable.Range(0, 10_000))}}]}""";

        var response = await _client.PostAsync(Path, Body.Definition(GroupOf([condition])));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Single(_engine.CallsTo(EngineStub.Validate));
    }

    [Theory]
    [InlineData("""{"type":"condition","id":"c1","left":{"field":"age"},"operator":"in","values":[1e30,1]}""")]
    [InlineData("""{"type":"condition","id":"c1","left":{"field":"age"},"operator":"in","values":[1e400,1]}""")]
    [InlineData("""{"type":1e30,"id":"c1","left":{"field":"age"},"operator":"lt","value":1}""")]
    public async Task Validate_leaves_the_definition_to_the_engine_when_a_number_is_outside_the_range_the_schema_library_compares(string node)
    {
        var response = await _client.PostAsync(Path, Body.Definition(GroupOf([node])));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Single(_engine.CallsTo(EngineStub.Validate));
    }

    [Fact]
    public async Task Validate_returns_503_engine_unavailable_when_the_schema_passes_and_the_engine_is_down()
    {
        _engine.Refuse(EngineStub.Validate);

        var response = await _client.PostAsync(Path, Body.Definition(Examples.Definition(Examples.First)));

        await HttpAssert.ProblemAsync(response, HttpStatusCode.ServiceUnavailable, "ENGINE_UNAVAILABLE");
    }

    /// <summary>A definition whose root group holds the given children, written as JSON.</summary>
    private static string GroupOf(IEnumerable<string> children) =>
        $$"""{"schemaVersion":1,"rootEntity":"employee","where":{"type":"group","op":"and","children":[{{string.Join(',', children)}}]} }""";
}
