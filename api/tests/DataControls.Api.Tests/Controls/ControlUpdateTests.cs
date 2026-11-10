using System.Net;
using System.Text.Json;
using DataControls.Api.Controls;
using DataControls.Api.Errors;
using DataControls.Api.Persistence;
using DataControls.Api.Tests.Support;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DataControls.Api.Tests.Controls;

/// <summary><c>PUT /api/v1/controls/{id}</c>: versions, the concurrency token and the order of the checks.</summary>
[Collection(ApiCollection.Name)]
public sealed class ControlUpdateTests(ApiFixture fixture)
{
    private const string OtherExample = "department-without-active-employees";

    private readonly HttpClient _client = fixture.CreateClient();
    private readonly EngineStub _engine = fixture.Factory.Engine;
    private readonly string _testId = TestData.NewTestId();

    [Fact]
    public async Task Update_writes_version_2_and_keeps_version_1_readable_when_the_definition_changed()
    {
        var created = await CreateAsync();
        var path = ControlRequests.PathOf(created.GetProperty("id").GetInt32());
        var newDefinition = Examples.Definition(OtherExample);

        var response = await ControlRequests.UpdateAsync(_client, created, definitionJson: newDefinition);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.ReadJsonAsync();
        Assert.Equal(2, updated.GetProperty("version").GetInt32());
        Assert.NotEqual(Examples.RootEntity(Examples.First), Examples.RootEntity(OtherExample));
        Assert.Equal(Examples.RootEntity(OtherExample), updated.GetProperty("rootEntity").GetString());
        HttpAssert.JsonEqual(newDefinition, updated.GetProperty("definition").GetRawText());
        Assert.NotEqual(created.GetProperty("concurrencyToken").GetString(), updated.GetProperty("concurrencyToken").GetString());

        var versions = await (await _client.GetAsync($"{path}/versions")).ReadJsonAsync();
        Assert.Equal([2, 1], versions.EnumerateArray().Select(version => version.GetProperty("version").GetInt32()));
        Assert.NotEqual(versions[0].GetProperty("definitionHash").GetString(), versions[1].GetProperty("definitionHash").GetString());
        var first = await (await _client.GetAsync($"{path}/versions/1")).ReadJsonAsync();
        HttpAssert.JsonEqual(created.GetProperty("definition").GetRawText(), first.GetProperty("definition").GetRawText());
        Assert.Equal(2, _engine.CallsTo(EngineStub.Validate).Count);
    }

    [Fact]
    public async Task Update_renames_without_a_new_version_and_without_the_engine_when_only_the_name_changed()
    {
        var created = await CreateAsync();
        _engine.Reset();
        _engine.RefuseEverything();
        var newName = TestData.Name(_testId, "renamed");

        var response = await ControlRequests.UpdateAsync(_client, created, name: newName, description: "now described");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.ReadJsonAsync();
        Assert.Equal(newName, updated.GetProperty("name").GetString());
        Assert.Equal("now described", updated.GetProperty("description").GetString());
        Assert.Equal(1, updated.GetProperty("version").GetInt32());
        Assert.NotEqual(created.GetProperty("concurrencyToken").GetString(), updated.GetProperty("concurrencyToken").GetString());
        Assert.Empty(_engine.Calls);
    }

    [Fact]
    public async Task Update_keeps_the_version_when_the_definition_differs_only_in_key_order_and_layout()
    {
        var created = await CreateAsync();
        var sameRule = Examples.Reordered(created.GetProperty("definition").GetRawText());
        Assert.NotEqual(created.GetProperty("definition").GetRawText(), sameRule);
        _engine.Reset();

        var response = await ControlRequests.UpdateAsync(_client, created, definitionJson: sameRule);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, (await response.ReadJsonAsync()).GetProperty("version").GetInt32());
        Assert.Empty(_engine.Calls);
    }

    [Fact]
    public async Task Update_returns_the_control_as_it_is_and_writes_nothing_when_nothing_changed()
    {
        var created = await CreateAsync();

        var response = await ControlRequests.UpdateAsync(_client, created);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        HttpAssert.JsonEqual(created.GetRawText(), (await response.ReadJsonAsync()).GetRawText());
    }

    [Fact]
    public async Task Update_clears_the_description_when_the_request_leaves_it_out()
    {
        var created = await ControlRequests.CreateAsync(_client, TestData.Name(_testId), description: "to be cleared");

        var response = await ControlRequests.UpdateAsync(_client, created);

        Assert.Equal(JsonValueKind.Null, (await response.ReadJsonAsync()).GetProperty("description").ValueKind);
    }

    [Fact]
    public async Task Update_returns_409_concurrency_conflict_with_the_id_when_the_token_is_stale()
    {
        var created = await CreateAsync();
        await ControlRequests.UpdateAsync(_client, created, name: TestData.Name(_testId, "first save"));

        var response = await ControlRequests.UpdateAsync(_client, created, name: TestData.Name(_testId, "second save"));

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.Conflict, "CONCURRENCY_CONFLICT");
        HttpAssert.JsonEqual($$"""{"id":{{created.GetProperty("id").GetInt32()}} }""", problem.GetProperty("params").GetRawText());
    }

    [Theory]
    [InlineData("not base64 at all")]
    [InlineData("AAAA")]
    [InlineData("AAAAAAAAAAAAAAAA")]
    public async Task Update_returns_400_malformed_at_the_token_when_it_is_not_a_token(string token)
    {
        var created = await CreateAsync();

        var response = await ControlRequests.UpdateAsync(_client, created, concurrencyToken: token);

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.BadRequest, "REQUEST_INVALID");
        HttpAssert.JsonEqual("""[{"path":"/concurrencyToken","code":"MALFORMED","params":{}}]""", HttpAssert.Errors(problem));
    }

    [Fact]
    public async Task Update_returns_400_required_at_the_token_when_it_is_missing()
    {
        var created = await CreateAsync();

        var response = await _client.PutAsync(
            ControlRequests.PathOf(created.GetProperty("id").GetInt32()),
            ControlRequests.Save(TestData.Name(_testId), Examples.Definition(Examples.First)));

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.BadRequest, "REQUEST_INVALID");
        HttpAssert.JsonEqual("""[{"path":"/concurrencyToken","code":"REQUIRED","params":{}}]""", HttpAssert.Errors(problem));
    }

    [Fact]
    public async Task Update_returns_409_control_archived_before_it_looks_at_the_token_when_the_control_is_archived()
    {
        var created = await CreateAsync();
        var id = created.GetProperty("id").GetInt32();
        await _client.DeleteAsync(ControlRequests.PathOf(id));

        var response = await ControlRequests.UpdateAsync(_client, created, name: TestData.Name(_testId, "too late"), concurrencyToken: "not a token");

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.Conflict, "CONTROL_ARCHIVED");
        HttpAssert.JsonEqual($$"""{"id":{{id}} }""", problem.GetProperty("params").GetRawText());
    }

    [Fact]
    public async Task Update_answers_in_the_contract_order_when_more_than_one_check_would_fail()
    {
        var created = await CreateAsync();
        await ControlRequests.UpdateAsync(_client, created, name: TestData.Name(_testId, "moves the token on"));
        var brokenDefinition = Examples.Invalid("condition-without-operator").GetProperty("definition").GetRawText();

        var requestFirst = await _client.PutAsync(ControlRequests.PathOf(int.MaxValue), ControlRequests.Save(null, brokenDefinition, concurrencyToken: "AAAAAAAAAAA="));
        var notFound = await _client.PutAsync(ControlRequests.PathOf(int.MaxValue), ControlRequests.Save("a name", brokenDefinition, concurrencyToken: "AAAAAAAAAAA="));
        var tokenFirst = await ControlRequests.UpdateAsync(_client, created, definitionJson: brokenDefinition);

        await HttpAssert.ProblemAsync(requestFirst, HttpStatusCode.BadRequest, "REQUEST_INVALID");
        await HttpAssert.ProblemAsync(notFound, HttpStatusCode.NotFound, "CONTROL_NOT_FOUND");
        await HttpAssert.ProblemAsync(tokenFirst, HttpStatusCode.Conflict, "CONCURRENCY_CONFLICT");
    }

    [Fact]
    public async Task Update_returns_422_from_the_schema_and_leaves_the_control_alone_when_the_new_definition_is_invalid()
    {
        var created = await CreateAsync();
        _engine.Reset();

        var response = await ControlRequests.UpdateAsync(
            _client,
            created,
            name: TestData.Name(_testId, "not saved"),
            definitionJson: Examples.Invalid("value-with-is-null").GetProperty("definition").GetRawText());

        await HttpAssert.ProblemAsync(response, HttpStatusCode.UnprocessableEntity, "DEFINITION_INVALID");
        Assert.Empty(_engine.Calls);
        await AssertUnchangedAsync(created);
    }

    [Fact]
    public async Task Update_relays_422_and_leaves_the_control_alone_when_the_engine_rejects_the_new_definition()
    {
        var created = await CreateAsync();
        _engine.Answer(EngineStub.Validate, HttpStatusCode.UnprocessableEntity, EngineFixtures.Read("problem-definition-invalid.json"));

        var response = await ControlRequests.UpdateAsync(_client, created, definitionJson: Examples.Definition(OtherExample));

        var problem = await HttpAssert.ProblemAsync(response, HttpStatusCode.UnprocessableEntity, "DEFINITION_INVALID");
        Assert.Equal("UNKNOWN_FIELD", problem.GetProperty("errors")[0].GetProperty("code").GetString());
        await AssertUnchangedAsync(created);
    }

    [Fact]
    public async Task Update_returns_503_engine_unavailable_and_leaves_the_control_alone_when_the_definition_changed_and_the_engine_is_down()
    {
        var created = await CreateAsync();
        _engine.RefuseEverything();

        var response = await ControlRequests.UpdateAsync(_client, created, definitionJson: Examples.Definition(OtherExample));

        await HttpAssert.ProblemAsync(response, HttpStatusCode.ServiceUnavailable, "ENGINE_UNAVAILABLE");
        await AssertUnchangedAsync(created);
    }

    [Fact]
    public async Task Update_returns_409_when_another_save_lands_between_the_token_check_and_the_write()
    {
        var created = await CreateAsync();
        var id = created.GetProperty("id").GetInt32();
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<DqDbContext>();
        // This scope read the control before the other save, so its own check of the token still passes.
        await db.Controls.SingleAsync(control => control.Id == id);
        await ControlRequests.UpdateAsync(_client, created, name: TestData.Name(_testId, "the other save"));
        var request = new UpdateControlRequest(
            TestData.Name(_testId, "the late save"),
            null,
            created.GetProperty("definition"),
            created.GetProperty("concurrencyToken").GetString());

        var failure = await Assert.ThrowsAsync<ApiException>(() =>
            scope.ServiceProvider.GetRequiredService<ControlService>().UpdateAsync(id, request, CancellationToken.None));

        Assert.Equal((409, "CONCURRENCY_CONFLICT"), (failure.Status, failure.Code));
    }

    [Fact]
    public async Task Update_returns_409_when_two_saves_of_a_new_definition_race_for_the_same_version_number()
    {
        var created = await CreateAsync();
        var id = created.GetProperty("id").GetInt32();
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<DqDbContext>().Controls.SingleAsync(control => control.Id == id);
        var winner = await ControlRequests.UpdateAsync(_client, created, definitionJson: Examples.Definition(OtherExample));
        using var lateDefinition = JsonDocument.Parse(Examples.Definition("termination-before-hire"));
        var request = new UpdateControlRequest(
            created.GetProperty("name").GetString(),
            null,
            lateDefinition.RootElement,
            created.GetProperty("concurrencyToken").GetString());

        var failure = await Assert.ThrowsAsync<ApiException>(() =>
            scope.ServiceProvider.GetRequiredService<ControlService>().UpdateAsync(id, request, CancellationToken.None));

        Assert.Equal(HttpStatusCode.OK, winner.StatusCode);
        Assert.Equal((409, "CONCURRENCY_CONFLICT"), (failure.Status, failure.Code));
        var versions = await (await _client.GetAsync($"{ControlRequests.PathOf(id)}/versions")).ReadJsonAsync();
        Assert.Equal(2, versions.GetArrayLength());
    }

    [Fact]
    public async Task Archive_applies_to_the_row_as_it_is_now_when_another_save_landed_first()
    {
        var created = await CreateAsync();
        var id = created.GetProperty("id").GetInt32();
        var renamed = TestData.Name(_testId, "renamed just before the archive");
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<DqDbContext>().Controls.SingleAsync(control => control.Id == id);
        await ControlRequests.UpdateAsync(_client, created, name: renamed);

        await scope.ServiceProvider.GetRequiredService<ControlService>().ArchiveAsync(id, CancellationToken.None);

        var read = await (await _client.GetAsync(ControlRequests.PathOf(id))).ReadJsonAsync();
        Assert.False(read.GetProperty("isActive").GetBoolean());
        Assert.Equal(renamed, read.GetProperty("name").GetString());
    }

    private Task<JsonElement> CreateAsync() => ControlRequests.CreateAsync(_client, TestData.Name(_testId));

    private async Task AssertUnchangedAsync(JsonElement created)
    {
        var read = await (await _client.GetAsync(ControlRequests.PathOf(created.GetProperty("id").GetInt32()))).ReadJsonAsync();
        HttpAssert.JsonEqual(created.GetRawText(), read.GetRawText());
    }
}
