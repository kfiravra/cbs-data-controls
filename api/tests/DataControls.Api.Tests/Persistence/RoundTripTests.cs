using DataControls.Api.Persistence;
using DataControls.Api.Tests.Support;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DataControls.Api.Tests.Persistence;

/// <summary>
/// The model against the tables of <c>sql/30_dq_tables.sql</c>: one row of each, written and read back, so
/// a column the model names differently fails here and not in a later phase.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class RoundTripTests(ApiFixture fixture)
{
    private static readonly DateTime _createdAt = new(2026, 11, 10, 19, 44, 3, 120, DateTimeKind.Utc);
    private static readonly DateTime _finishedAt = new(2026, 11, 10, 19, 44, 4, 5, DateTimeKind.Utc);

    [Fact]
    public async Task One_row_of_each_table_reads_back_as_written()
    {
        var name = TestData.Name(TestData.NewTestId(), "בקרה עם שם בעברית");
        var definition = new StoredDefinition("""{"schemaVersion":1,"rootEntity":"employee"}""", new string('a', 64), "employee");
        var result = new RunResult(1, "1051", """{"first_name":"אריאל"}""", "אריאל מור 1051", ["c1", "c2"], """[{"conditionId":"c1"}]""", "גיל: 16");
        int controlId;
        int runId;

        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<DqDbContext>();
            var control = Control.Create(name, "תיאור", definition, _createdAt);
            db.Controls.Add(control);
            await db.SaveChangesAsync();
            controlId = control.Id;

            var run = Run.Start(controlId, 1, new DateOnly(2026, 11, 1), "he", "corr-1", _createdAt);
            db.Runs.Add(run);
            await db.SaveChangesAsync();
            run.Succeed(new RunOutcome(3, 41, """{"sentence":"גיל מתחת ל־18"}""", "0.1.0"), [result], _finishedAt);
            await db.SaveChangesAsync();
            runId = run.Id;
        }

        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<DqDbContext>();

            var control = await db.Controls.Include(c => c.Versions).SingleAsync(c => c.Id == controlId);
            Assert.Equal(name, control.Name);
            Assert.Equal("תיאור", control.Description);
            Assert.Equal("employee", control.RootEntityKey);
            Assert.Equal(1, control.CurrentVersion);
            Assert.True(control.IsActive);
            Assert.Equal(_createdAt, control.CreatedAt);
            Assert.Equal(DateTimeKind.Utc, control.CreatedAt.Kind);
            Assert.Equal(_createdAt, control.UpdatedAt);
            Assert.Equal(8, control.RowVersion.Length);

            var version = Assert.Single(control.Versions);
            Assert.Equal((controlId, 1), (version.ControlId, version.Version));
            Assert.Equal(definition.Json, version.Definition);
            Assert.Equal(definition.Hash, version.DefinitionHash);
            Assert.Equal(_createdAt, version.CreatedAt);

            var run = await db.Runs.Include(r => r.Results).SingleAsync(r => r.Id == runId);
            Assert.Equal((controlId, 1), (run.ControlId, run.VersionNumber));
            Assert.Equal(new DateOnly(2026, 11, 1), run.RunDate);
            Assert.Equal("he", run.Language);
            Assert.Equal(_createdAt, run.StartedAt);
            Assert.Equal(_finishedAt, run.FinishedAt);
            Assert.Equal(DateTimeKind.Utc, run.FinishedAt?.Kind);
            Assert.Equal(RunStatus.Succeeded, run.Status);
            Assert.Equal((3, 1, 41), (run.TotalCount, run.StoredCount, run.DurationMs));
            Assert.Equal("""{"sentence":"גיל מתחת ל־18"}""", run.Summary);
            Assert.Null(run.ErrorCode);
            Assert.Null(run.ErrorParams);
            Assert.Equal("0.1.0", run.EngineVersion);
            Assert.Equal("corr-1", run.CorrelationId);

            var stored = Assert.Single(run.Results);
            Assert.True(stored.Id > 0);
            Assert.Equal((runId, 1, "1051"), (stored.RunId, stored.Seq, stored.RecordKey));
            Assert.Equal("""{"first_name":"אריאל"}""", stored.RecordDisplay);
            Assert.Equal("אריאל מור 1051", stored.DisplayText);
            Assert.Equal(["c1", "c2"], stored.MatchedConditionIds);
            Assert.Equal("""[{"conditionId":"c1"}]""", stored.Reasons);
            Assert.Equal("גיל: 16", stored.ReasonText);

            var matching = await db.RunResults.CountAsync(r => r.RunId == runId && r.MatchedConditionIds.Contains("c2"));
            Assert.Equal(1, matching);
        }
    }
}
