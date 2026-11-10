using DataControls.Api.Errors;
using DataControls.Api.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace DataControls.Api.Runs;

[ApiController]
[Problem(StatusCodes.Status400BadRequest)]
[Problem(StatusCodes.Status500InternalServerError)]
public sealed class RunsController(RunService runs, RunQueries queries) : ControllerBase
{
    /// <summary>Runs the control now and answers when the run has finished: 201 also when the run failed.</summary>
    [ProducesResponseType<RunResponse>(StatusCodes.Status201Created)]
    [Problem(StatusCodes.Status404NotFound)]
    [Problem(StatusCodes.Status409Conflict)]
    [Problem(StatusCodes.Status503ServiceUnavailable)]
    [HttpPost("api/v1/controls/{id:long:min(1)}/runs")]
    public async Task<IActionResult> Start(
        long id,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] StartRunRequest? request,
        CancellationToken cancellationToken)
    {
        var run = await runs.StartAsync(id, request, cancellationToken);
        return Created($"/api/v1/runs/{run.Id}", run);
    }

    /// <summary>The control's runs, newest first.</summary>
    [ProducesResponseType(StatusCodes.Status200OK)]
    [Problem(StatusCodes.Status404NotFound)]
    [Problem(StatusCodes.Status503ServiceUnavailable)]
    [HttpGet("api/v1/controls/{id:long:min(1)}/runs")]
    public Task<PagedResponse<RunResponse>> History(long id, int? page, int? pageSize, CancellationToken cancellationToken) =>
        queries.ListAsync(id, page, pageSize, cancellationToken);

    [ProducesResponseType(StatusCodes.Status200OK)]
    [Problem(StatusCodes.Status404NotFound)]
    [Problem(StatusCodes.Status503ServiceUnavailable)]
    [HttpGet("api/v1/runs/{id:long:min(1)}")]
    public Task<RunResponse> Get(long id, CancellationToken cancellationToken) => queries.GetAsync(id, cancellationToken);

    /// <summary>A page of the run's stored violations: searched, filtered and sorted in the snapshot.</summary>
    [ProducesResponseType(StatusCodes.Status200OK)]
    [Problem(StatusCodes.Status404NotFound)]
    [Problem(StatusCodes.Status503ServiceUnavailable)]
    [HttpGet("api/v1/runs/{id:long:min(1)}/results")]
    public Task<PagedResponse<ResultItemResponse>> Results(
        long id,
        string? search,
        string? condition,
        string? sort,
        string? dir,
        int? page,
        int? pageSize,
        CancellationToken cancellationToken) =>
        queries.ResultsAsync(id, new ResultsQuery(search, condition, sort, dir, page, pageSize), cancellationToken);
}
