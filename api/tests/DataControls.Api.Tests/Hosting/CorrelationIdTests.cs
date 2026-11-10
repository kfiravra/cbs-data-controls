using System.Text.RegularExpressions;
using DataControls.Api.Tests.Support;

namespace DataControls.Api.Tests.Hosting;

[Collection(ApiCollection.Name)]
public sealed partial class CorrelationIdTests(ApiFixture fixture)
{
    private const string Header = "X-Correlation-Id";

    private readonly HttpClient _client = fixture.CreateClient();

    [Theory]
    [InlineData("abc-123")]
    [InlineData("A.b_c-9")]
    public async Task Correlation_id_is_echoed_when_it_has_the_contract_form(string id)
    {
        var response = await SendAsync("/_probe/context", id);

        Assert.Equal(id, Assert.Single(response.Headers.GetValues(Header)));
        Assert.Equal(id, (await response.ReadJsonAsync()).GetProperty("correlationId").GetString());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("has space")]
    [InlineData("semi;colon")]
    [InlineData("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")]
    public async Task Correlation_id_is_created_when_none_is_sent_or_it_has_another_form(string? sent)
    {
        var response = await SendAsync("/_probe/context", sent);

        var id = Assert.Single(response.Headers.GetValues(Header));
        Assert.Matches(ThirtyTwoHex(), id);
        Assert.NotEqual(sent, id);
    }

    [Fact]
    public async Task Problem_carries_the_correlation_id_of_the_response_header()
    {
        var response = await SendAsync("/_probe/failure", "trace-me-42");

        Assert.Equal("trace-me-42", Assert.Single(response.Headers.GetValues(Header)));
        Assert.Equal("trace-me-42", (await response.ReadJsonAsync()).GetProperty("correlationId").GetString());
    }

    private Task<HttpResponseMessage> SendAsync(string path, string? correlationId)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, path);
        if (correlationId is not null)
        {
            request.Headers.TryAddWithoutValidation(Header, correlationId);
        }

        return _client.SendAsync(request);
    }

    [GeneratedRegex("^[0-9a-f]{32}$")]
    private static partial Regex ThirtyTwoHex();
}
