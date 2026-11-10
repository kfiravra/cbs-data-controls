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
    public void Declared_codes_are_exactly_the_catalogue_rows_when_the_row_is_from_the_api_or_both()
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
    public void Problem_status_is_the_catalogue_status_when_the_code_has_one()
    {
        var expected = _catalogue
            .Where(SentByTheApi)
            .Where(row => FirstNumber().IsMatch(row[Status]))
            .ToDictionary(row => row[Code], row => int.Parse(FirstNumber().Match(row[Status]).Value));

        Assert.Equal(expected.OrderBy(pair => pair.Key), ErrorCodes.ProblemStatus.OrderBy(pair => pair.Key));
    }

    [Fact]
    public void Run_error_codes_are_the_catalogue_rows_when_the_row_is_marked_run_error()
    {
        var expected = _catalogue.Where(SentByTheApi).Where(row => row[RunError] == "yes").Select(row => row[Code]).Order();

        Assert.Equal(expected, ErrorCodes.RunErrors.Order());
    }

    [Fact]
    public void Request_error_codes_are_the_catalogue_table_when_read_from_errors_md()
    {
        var expected = ContractFiles.ErrorTable("Request error codes").Select(row => row[Code]).Order();

        Assert.Equal(expected, RequestErrorCodes.All.Order());
    }

    [Fact]
    public void Definition_error_codes_of_the_api_are_catalogue_rows_when_their_layer_is_the_schema_or_before_it()
    {
        var expected = ContractFiles.ErrorTable("Definition error codes")
            .Where(row => row[1] is "schema" or "before the schema")
            .Select(row => row[Code])
            .Order();

        var declared = typeof(DefinitionErrorCodes)
            .GetFields(BindingFlags.Public | BindingFlags.Static)
            .Select(field => (string)field.GetRawConstantValue()!)
            .Order();

        Assert.Equal(expected, declared);
    }

    private static bool SentByTheApi(string[] row) => row[From] is "api" or "both";

    [GeneratedRegex(@"\d{3}")]
    private static partial Regex FirstNumber();
}
