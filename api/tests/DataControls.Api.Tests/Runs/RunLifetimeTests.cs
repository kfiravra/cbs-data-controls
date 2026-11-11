using System.Net;
using System.Text.Json;
using DataControls.Api.Persistence;
using DataControls.Api.Runs;
using DataControls.Api.Tests.Support;
using Microsoft.Extensions.DependencyInjection;

namespace DataControls.Api.Tests.Runs;

/// <summary>
/// What a run does around its edges: a client that leaves, a host that stops, a cap below what the engine
/// returns, a glossary that changed or cannot be had. Each test starts a host of its own, because each
/// touches what belongs to the host: its settings, its glossary cache or its lifetime.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class RunLifetimeTests : IAsyncLifetime
{
    private static readonly TimeSpan _patience = TimeSpan.FromSeconds(10);

    private readonly string _testId = TestData.NewTestId();
    private readonly string _rootEntity = RunAnswers.AnyRootEntity;
    private ApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    [Fact]
    public async Task Run_is_closed_succeeded_when_the_client_leaves_while_the_engine_is_working()
    {
        var client = _factory.CreateClient();
        var controlId = await CreateControlAsync(client);
        _factory.Engine.Answer(EngineStub.Run, HttpStatusCode.OK, RunAnswers.Numbered(2));
        _factory.Engine.Delay(EngineStub.Run, TimeSpan.FromMilliseconds(400));
        using var clientPatience = new CancellationTokenSource();

        var abandoned = client.PostAsync(RunRequests.RunsOf(controlId), null, clientPatience.Token);
        await WaitForAsync(() => _factory.Engine.CallsTo(EngineStub.Run).Count == 1);
        await clientPatience.CancelAsync();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => abandoned);

        var run = await WaitForClosedRunAsync(client, controlId);
        Assert.Equal("succeeded", run.GetProperty("status").GetString());
        Assert.Equal(2, run.GetProperty("storedCount").GetInt32());
    }

    [Fact]
    public async Task Run_is_closed_failed_and_still_answered_when_the_host_starts_stopping_during_the_engine_call()
    {
        await _factory.DisposeAsync();
        _factory = new ApiFactory(new Dictionary<string, string> { ["Engine:AttemptTimeout"] = "00:01:00" });
        var controlId = await CreateControlAsync(_factory.CreateClient());
        _factory.Engine.Delay(EngineStub.Run, TimeSpan.FromMinutes(1));
        await using var scope = _factory.Services.CreateAsyncScope();
        using var lifetime = new StoppableLifetime();
        // The service as the host builds it, except for the lifetime, which this test signals itself.
        var runs = ActivatorUtilities.CreateInstance<RunService>(scope.ServiceProvider, lifetime);

        var pending = runs.StartAsync(controlId, null, CancellationToken.None);
        await WaitForAsync(() => _factory.Engine.CallsTo(EngineStub.Run).Count == 1);
        lifetime.StopApplication();
        var run = await pending;

        Assert.Equal(RunStatus.Failed, run.Status);
        Assert.Equal("INTERNAL_ERROR", run.Error?.Code);
        Assert.NotNull(run.FinishedAt);
        Assert.Null(run.TotalCount);
    }

    [Fact]
    public async Task Run_stores_no_more_than_the_row_cap_and_asks_the_engine_for_it_when_the_engine_returns_more()
    {
        await _factory.DisposeAsync();
        _factory = new ApiFactory(new Dictionary<string, string> { ["Runs:RowCap"] = "3" });
        var client = _factory.CreateClient();
        var controlId = await CreateControlAsync(client);
        _factory.Engine.Answer(EngineStub.Run, HttpStatusCode.OK, RunAnswers.Numbered(5));

        var run = await RunRequests.StartAsync(client, controlId);
        var results = await RunRequests.ResultsAsync(client, run.GetProperty("id").GetInt32());

        Assert.Equal((5, 3, true), (run.GetProperty("totalCount").GetInt32(), run.GetProperty("storedCount").GetInt32(), run.GetProperty("capExceeded").GetBoolean()));
        Assert.Equal(["1001", "1002", "1003"], RunRequests.Keys(results));
        using var sent = JsonDocument.Parse(Assert.Single(_factory.Engine.CallsTo(EngineStub.Run)).Body);
        Assert.Equal(3, sent.RootElement.GetProperty("rowCap").GetInt32());
    }

    [Fact]
    public async Task Glossary_is_fetched_again_when_a_run_reports_another_version_than_the_one_held()
    {
        var client = _factory.CreateClient();
        var controlId = await CreateControlAsync(client);
        await client.GetAsync("/api/v1/glossary");

        _factory.Engine.Answer(EngineStub.Run, HttpStatusCode.OK, RunAnswers.Numbered(1));
        await RunRequests.StartAsync(client, controlId);
        var callsAfterARunOfTheSameVersion = _factory.Engine.CallsTo(EngineStub.Glossary).Count;
        _factory.Engine.Answer(EngineStub.Run, HttpStatusCode.OK, RunAnswers.Build(_rootEntity, [new RunAnswers.Violation("1", ["c1"])], 1, glossaryVersion: "9.9.9"));
        await RunRequests.StartAsync(client, controlId);

        Assert.Equal(1, callsAfterARunOfTheSameVersion);
        Assert.Equal(2, _factory.Engine.CallsTo(EngineStub.Glossary).Count);
    }

    [Fact]
    public async Task Run_keeps_the_display_values_in_the_order_the_engine_wrote_them_when_no_glossary_can_be_had()
    {
        var client = _factory.CreateClient();
        var controlId = await CreateControlAsync(client);
        var violation = new RunAnswers.Violation("1051", ["c1"]);
        var tokens = RunAnswers.DisplayTokens(_rootEntity, violation);
        _factory.Engine.Answer(EngineStub.Run, HttpStatusCode.OK, RunAnswers.Build(_rootEntity, [violation], 1));
        _factory.Engine.Refuse(EngineStub.Glossary);

        var run = await RunRequests.StartAsync(client, controlId);
        var runId = run.GetProperty("id").GetInt32();
        var inTheOrderWritten = await RunRequests.ResultsAsync(client, runId, $"?search={Uri.EscapeDataString($"{tokens[1]} {tokens[0]}")}");
        var inGlossaryOrder = await RunRequests.ResultsAsync(client, runId, $"?search={Uri.EscapeDataString($"{tokens[0]} {tokens[1]}")}");

        Assert.Equal("succeeded", run.GetProperty("status").GetString());
        Assert.Equal(["1051"], RunRequests.Keys(inTheOrderWritten));
        Assert.Empty(RunRequests.Keys(inGlossaryOrder));
    }

    private async Task<int> CreateControlAsync(HttpClient client) =>
        (await ControlRequests.CreateAsync(client, TestData.Name(_testId))).GetProperty("id").GetInt32();

    private static async Task WaitForAsync(Func<bool> condition)
    {
        using var patience = new CancellationTokenSource(_patience);
        while (!condition())
        {
            await Task.Delay(TimeSpan.FromMilliseconds(20), patience.Token);
        }
    }

    /// <summary>The control's one run, once it is no longer <c>running</c>.</summary>
    private static async Task<JsonElement> WaitForClosedRunAsync(HttpClient client, int controlId)
    {
        using var patience = new CancellationTokenSource(_patience);
        while (true)
        {
            var history = await (await client.GetAsync(RunRequests.RunsOf(controlId), patience.Token)).ReadJsonAsync();
            var run = history.GetProperty("items").EnumerateArray().FirstOrDefault();
            if (run.ValueKind == JsonValueKind.Object && run.GetProperty("status").GetString() != "running")
            {
                return run;
            }

            await Task.Delay(TimeSpan.FromMilliseconds(50), patience.Token);
        }
    }
}
