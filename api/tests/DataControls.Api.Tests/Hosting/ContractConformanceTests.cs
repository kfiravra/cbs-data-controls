using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using DataControls.Api.Tests.Support;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace DataControls.Api.Tests.Hosting;

/// <summary>
/// What the host maps and what it documents, against the application table of <c>contracts/api.md</c>:
/// that table is the complete list of what is served under <c>/api/v1</c>.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed partial class ContractConformanceTests(ApiFixture fixture)
{
    private const string ApplicationPrefix = "/api/v1";

    private static readonly int[] _everywhere = [400, 500];
    private static readonly int[] _withABody = [413, 415];

    [Fact]
    public void Mapped_endpoints_are_exactly_the_contract_table_when_only_api_v1_is_counted()
    {
        var expected = ContractEndpoints.Application.Select(endpoint => endpoint.ToString()).Order();

        var mapped = fixture.Factory.Services.GetServices<EndpointDataSource>()
            .SelectMany(source => source.Endpoints)
            .OfType<RouteEndpoint>()
            // An endpoint mapped for every method carries no method metadata: it is listed as ANY, so it cannot hide.
            .Select(endpoint => (Path: Normalise(endpoint.RoutePattern.RawText), Methods: endpoint.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods ?? ["ANY"]))
            .Where(endpoint => endpoint.Path.StartsWith(ApplicationPrefix, StringComparison.Ordinal))
            .SelectMany(endpoint => endpoint.Methods.Select(method => $"{method} {endpoint.Path}"))
            .Order();

        Assert.Equal(expected, mapped);
    }

    [Fact]
    public async Task Open_api_document_lists_every_contract_path_and_method_and_nothing_else_under_api_v1()
    {
        var document = await DocumentAsync();
        var expected = ContractEndpoints.Application.Select(endpoint => endpoint.ToString()).Order();

        var documented = document.GetProperty("paths").EnumerateObject()
            .Where(path => path.Name.StartsWith(ApplicationPrefix, StringComparison.Ordinal))
            .SelectMany(path => path.Value.EnumerateObject().Select(operation => $"{operation.Name.ToUpperInvariant()} {path.Name}"))
            .Order();

        Assert.Equal(expected, documented);
        Assert.Equal("Data Controls API", document.GetProperty("info").GetProperty("title").GetString());
        Assert.Equal("v1", document.GetProperty("info").GetProperty("version").GetString());
    }

    [Fact]
    public async Task Open_api_operation_lists_every_status_of_its_contract_row_when_the_row_names_it()
    {
        var paths = (await DocumentAsync()).GetProperty("paths");

        foreach (var endpoint in ContractEndpoints.Application)
        {
            var documented = paths.GetProperty(endpoint.Path).GetProperty(endpoint.Method.ToLowerInvariant()).GetProperty("responses")
                .EnumerateObject().Select(response => int.Parse(response.Name)).Order();
            // Every endpoint may also answer 400 and 500, except the health check, which is always 200; one
            // that takes a body may answer 413 and 415 as well (contracts/api.md §1, Format).
            IEnumerable<int> expected = endpoint.ErrorStatuses.Count == 0
                ? [endpoint.SuccessStatus]
                : endpoint.ErrorStatuses
                    .Append(endpoint.SuccessStatus)
                    .Concat(_everywhere)
                    .Concat(endpoint.Method is "POST" or "PUT" ? _withABody : [])
                    .Distinct();

            Assert.True(expected.Order().SequenceEqual(documented), $"{endpoint}: expected {string.Join(",", expected.Order())}, documented {string.Join(",", documented)}");
        }
    }

    [Fact]
    public void Requests_file_holds_exactly_one_request_per_contract_row_when_its_variables_are_read_as_segments()
    {
        var expected = ContractEndpoints.Application.Select(endpoint => endpoint.ToString()).Order();

        var requests = File.ReadAllLines(Path.Combine(AppContext.BaseDirectory, "requests.http"))
            .Select(line => RequestLine().Match(line))
            .Where(match => match.Success)
            .Select(match => $"{match.Groups["method"].Value} {ApplicationPrefix}{AsContractPath(match.Groups["path"].Value)}")
            .Order();

        Assert.Equal(expected, requests);
    }

    [Fact]
    public async Task Docs_page_is_the_swagger_ui_and_it_is_pointed_at_the_open_api_document()
    {
        var client = fixture.CreateClient();

        var page = await client.GetAsync("/api/docs");
        var pageText = await page.Content.ReadAsStringAsync();
        // The page loads its settings from the script beside it.
        var settings = await client.GetStringAsync("/api/docs/index.js");

        Assert.Equal(HttpStatusCode.OK, page.StatusCode);
        Assert.Equal("text/html", page.Content.Headers.ContentType?.MediaType);
        Assert.Contains("swagger-ui", pageText);
        Assert.Contains("/openapi/v1.json", pageText + settings);
    }

    private async Task<JsonElement> DocumentAsync()
    {
        var response = await fixture.CreateClient().GetAsync("/openapi/v1.json");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.ReadJsonAsync();
    }

    /// <summary><c>api/v1/controls/{id:int:min(1)}</c> as the contract writes it: <c>/api/v1/controls/{id}</c>.</summary>
    private static string Normalise(string? routePattern) => "/" + Constraint().Replace(routePattern ?? string.Empty, "{${name}}").TrimStart('/');

    /// <summary>
    /// A request line's path as the contract writes it: no query, the file's id variables as <c>{id}</c>, and
    /// the one literal version number as <c>{version}</c>.
    /// </summary>
    private static string AsContractPath(string path) =>
        VersionNumber().Replace(IdVariable().Replace(path.Split('?')[0], "{id}"), "/versions/{version}");

    [GeneratedRegex(@"\{(?<name>\w+)[^}]*\}")]
    private static partial Regex Constraint();

    [GeneratedRegex(@"^(?<method>GET|POST|PUT|DELETE) \{\{api\}\}(?<path>\S*)")]
    private static partial Regex RequestLine();

    [GeneratedRegex(@"\{\{(controlId|runId)\}\}")]
    private static partial Regex IdVariable();

    [GeneratedRegex(@"/versions/\d+")]
    private static partial Regex VersionNumber();
}
