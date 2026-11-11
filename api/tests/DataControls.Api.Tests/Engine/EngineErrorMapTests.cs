using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using DataControls.Api.Engine;
using DataControls.Api.Persistence;
using DataControls.Api.Tests.Support;

namespace DataControls.Api.Tests.Engine;

/// <summary>The error map against the table "Engine failures" of <c>contracts/api.md</c>, row by row.</summary>
public sealed partial class EngineErrorMapTests
{
    private const int EngineAnswer = 0;
    private const int InARequest = 1;
    private const int InARun = 2;

    public static TheoryData<string, string, string> Rows
    {
        get
        {
            var rows = new TheoryData<string, string, string>();
            foreach (var row in ContractFiles.ApiTable("Engine failures"))
            {
                rows.Add(row[EngineAnswer], row[InARequest], row[InARun]);
            }

            return rows;
        }
    }

    [Theory]
    [MemberData(nameof(Rows))]
    public void Engine_failure_becomes_the_contract_problem_when_it_happens_in_a_request(string engineAnswer, string inARequest, string inARun)
    {
        var expected = StatusAndCode().Match(inARequest);

        var problem = EngineErrorMap.ToProblem(FailureFor(engineAnswer));

        Assert.Equal(int.Parse(expected.Groups["status"].Value), problem.Status);
        Assert.Equal(expected.Groups["code"].Value, problem.Code);
        Assert.NotEmpty(inARun);
    }

    [Theory]
    [MemberData(nameof(Rows))]
    public void Engine_failure_closes_the_run_as_the_contract_says_when_it_happens_in_a_run(string engineAnswer, string inARequest, string inARun)
    {
        var expected = RunStatusAndCode().Match(inARun);

        var failure = EngineErrorMap.ToRunFailure(FailureFor(engineAnswer));

        Assert.Equal(expected.Groups["status"].Value, RunStatusNames.ToName(failure.Status));
        Assert.Equal(expected.Groups["code"].Value, failure.Code);
        Assert.NotEmpty(inARequest);
    }

    [Fact]
    public void Run_failure_carries_the_engine_errors_when_the_definition_is_outdated()
    {
        const string errors = """[{"code":"UNKNOWN_FIELD","path":"/where/children/1/left","nodeId":"c2","params":{"entity":"employee","field":"nickname"}}]""";
        var failure = EngineException.FromResponse(422, Encoding.UTF8.GetBytes(EngineFixtures.Problem("DEFINITION_INVALID", 422, errors: errors)));

        var closed = EngineErrorMap.ToRunFailure(failure);

        HttpAssert.JsonEqual($$"""{"errors":{{errors}}}""", closed.ParamsJson);
    }

    [Fact]
    public void Run_failure_carries_the_timeout_seconds_when_the_engine_timed_out()
    {
        var failure = EngineException.FromResponse(504, EngineFixtures.ReadBytes("problem-query-timeout.json"));

        var closed = EngineErrorMap.ToRunFailure(failure);

        HttpAssert.JsonEqual("""{"timeoutSeconds":30}""", closed.ParamsJson);
    }

    /// <summary>An engine failure of the kind a row's first cell describes, built the way the client builds it.</summary>
    private static EngineException FailureFor(string engineAnswer)
    {
        var named = StatusAndCode().Match(engineAnswer);
        if (named.Success)
        {
            var status = int.Parse(named.Groups["status"].Value);
            var code = named.Groups["code"].Value;
            return EngineException.FromResponse(status, Encoding.UTF8.GetBytes(EngineFixtures.Problem(code, status, errors: "[]")));
        }

        return engineAnswer.StartsWith("not reachable", StringComparison.Ordinal)
            ? EngineException.Unavailable(new HttpRequestException("refused"))
            : EngineException.FromResponse((int)HttpStatusCode.Conflict, Encoding.UTF8.GetBytes(EngineFixtures.Problem("SOMETHING_ELSE", 409)));
    }

    [GeneratedRegex(@"(?<status>\d{3}) `(?<code>[A-Z_]+)`")]
    private static partial Regex StatusAndCode();

    [GeneratedRegex(@"`(?<status>[a-z_]+)`, `(?<code>[A-Z_]+)`")]
    private static partial Regex RunStatusAndCode();
}
