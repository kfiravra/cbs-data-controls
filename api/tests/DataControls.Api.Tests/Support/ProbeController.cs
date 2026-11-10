using DataControls.Api.Errors;
using DataControls.Api.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace DataControls.Api.Tests.Support;

/// <summary>
/// A controller that exists only in the test host, outside <c>/api/v1</c>: it shows what the request
/// pipeline does with a body, a query parameter and a failure, whatever the real endpoints are.
/// </summary>
[ApiController]
[Route("_probe")]
public sealed class ProbeController(RequestContextAccessor requests) : ControllerBase
{
    public const int MaxNameLength = 10;
    public const int MinPage = 1;
    public const int MaxPage = 50;
    public const string Secret = "connection string of the probe";

    [HttpPost("items")]
    public IActionResult Create([FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] ProbeRequest? request)
    {
        var check = new RequestCheck();
        var name = check.Text("/name", request?.Name, MaxNameLength);
        var note = check.OptionalText("/note", request?.Note, MaxNameLength);
        check.ThrowIfInvalid();
        return Ok(new { name, note });
    }

    [HttpGet("items")]
    public IActionResult List(int? page)
    {
        var check = new RequestCheck();
        var number = check.Number("page", page, MinPage, MinPage, MaxPage);
        check.ThrowIfInvalid();
        return Ok(new { page = number });
    }

    [HttpGet("context")]
    public RequestContext Context() => requests.Current;

    [HttpGet("failure")]
    public IActionResult Fail() => throw new InvalidOperationException(Secret);
}

public sealed record ProbeRequest(string? Name, string? Note);
