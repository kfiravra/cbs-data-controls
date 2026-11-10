using System.Reflection;
using System.Text.RegularExpressions;
using DataControls.Api.Errors;
using DataControls.Api.Tests.Support;

namespace DataControls.Api.Tests.Errors;

/// <summary>The api's codes against <c>contracts/errors.md</c>: the catalogue is the source, not the code.</summary>
public sealed partial class ErrorCodesContractTests
{
    private const int Code = 0;
    private const int Status = 1;
    private const int From = 2;
    private const int RunError = 3;

    private static readonly IReadOnlyList<string[]> _catalogue = ContractFiles.ErrorTable("Codes");

    [Fact]
    public void Every_code_the_catalogue_gives_the_api_is_declared_and_no_other()
    {
        var expected = _catalogue.Where(SentByTheApi).Select(row => row[Code]).Order();

        var declared = typeof(ErrorCodes)
            .GetFields(BindingFlags.Public | BindingFlags.Static)
            .Where(field => field.IsLiteral)
            .Select(field => (string)field.GetRawConstantValue()!)
            .Order();

        Assert.Equal(expected, declared);
    }

    [Fact]
    public void Every_problem_code_has_the_status_of_the_catalogue()
    {
        var expected = _catalogue
            .Where(SentByTheApi)
            .Where(row => FirstNumber().IsMatch(row[Status]))
            .ToDictionary(row => row[Code], row => int.Parse(FirstNumber().Match(row[Status]).Value));

        Assert.Equal(expected.OrderBy(pair => pair.Key), ErrorCodes.ProblemStatus.OrderBy(pair => pair.Key));
    }

    [Fact]
    public void Run_error_codes_are_the_ones_the_catalogue_marks()
    {
        var expected = _catalogue.Where(SentByTheApi).Where(row => row[RunError] == "yes").Select(row => row[Code]).Order();

        Assert.Equal(expected, ErrorCodes.RunErrors.Order());
    }

    [Fact]
    public void Request_error_codes_are_the_catalogue_table()
    {
        var expected = ContractFiles.ErrorTable("Request error codes").Select(row => row[Code]).Order();

        Assert.Equal(expected, RequestErrorCodes.All.Order());
    }

    private static bool SentByTheApi(string[] row) => row[From] is "api" or "both";

    [GeneratedRegex(@"\d{3}")]
    private static partial Regex FirstNumber();
}
