using System.Text.Json;
using DataControls.Api.Errors;
using DataControls.Api.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace DataControls.Api.Controls;

[ApiController]
[Route("api/v1/controls")]
[Problem(StatusCodes.Status400BadRequest)]
[Problem(StatusCodes.Status500InternalServerError)]
public sealed class ControlsController(ControlService controls, DefinitionChecker definitions) : ControllerBase
{
    /// <summary>The controls, ordered by name unless <c>sort</c> asks otherwise: active ones unless <c>active</c> is <c>false</c> or <c>all</c>.</summary>
    [ProducesResponseType(StatusCodes.Status200OK)]
    [Problem(StatusCodes.Status503ServiceUnavailable)]
    [HttpGet]
    public Task<PagedResponse<ControlSummaryResponse>> List(
        string? search,
        string? rootEntity,
        string? active,
        string? sort,
        string? dir,
        int? page,
        int? pageSize,
        CancellationToken cancellationToken) =>
        controls.ListAsync(new ControlListQuery(search, rootEntity, active, sort, dir, page, pageSize), cancellationToken);

    /// <summary>Creates a control with version 1, after the schema and the engine have accepted its definition.</summary>
    [ProducesResponseType<ControlResponse>(StatusCodes.Status201Created)]
    [Problem(StatusCodes.Status422UnprocessableEntity)]
    [Problem(StatusCodes.Status503ServiceUnavailable)]
    [Problem(StatusCodes.Status413PayloadTooLarge)]
    [Problem(StatusCodes.Status415UnsupportedMediaType)]
    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] CreateControlRequest? request,
        CancellationToken cancellationToken)
    {
        var control = await controls.CreateAsync(request, cancellationToken);
        return Created(ControlLocation.Of(control.Id), control);
    }

    [ProducesResponseType(StatusCodes.Status200OK)]
    [Problem(StatusCodes.Status404NotFound)]
    [Problem(StatusCodes.Status503ServiceUnavailable)]
    [HttpGet("{id:long:min(1)}")]
    public Task<ControlResponse> Get(long id, CancellationToken cancellationToken) =>
        controls.GetAsync(id, cancellationToken);

    /// <summary>Saves a control; a changed definition becomes a new version.</summary>
    [ProducesResponseType(StatusCodes.Status200OK)]
    [Problem(StatusCodes.Status404NotFound)]
    [Problem(StatusCodes.Status409Conflict)]
    [Problem(StatusCodes.Status422UnprocessableEntity)]
    [Problem(StatusCodes.Status503ServiceUnavailable)]
    [Problem(StatusCodes.Status413PayloadTooLarge)]
    [Problem(StatusCodes.Status415UnsupportedMediaType)]
    [HttpPut("{id:long:min(1)}")]
    public Task<ControlResponse> Update(
        long id,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] UpdateControlRequest? request,
        CancellationToken cancellationToken) =>
        controls.UpdateAsync(id, request, cancellationToken);

    /// <summary>Archives the control. Its versions and runs stay readable.</summary>
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [Problem(StatusCodes.Status404NotFound)]
    [Problem(StatusCodes.Status503ServiceUnavailable)]
    [HttpDelete("{id:long:min(1)}")]
    public async Task<IActionResult> Archive(long id, CancellationToken cancellationToken)
    {
        await controls.ArchiveAsync(id, cancellationToken);
        return NoContent();
    }

    [ProducesResponseType(StatusCodes.Status200OK)]
    [Problem(StatusCodes.Status404NotFound)]
    [Problem(StatusCodes.Status503ServiceUnavailable)]
    [HttpGet("{id:long:min(1)}/versions")]
    public Task<IReadOnlyList<ControlVersionSummaryResponse>> Versions(long id, CancellationToken cancellationToken) =>
        controls.GetVersionsAsync(id, cancellationToken);

    [ProducesResponseType(StatusCodes.Status200OK)]
    [Problem(StatusCodes.Status404NotFound)]
    [Problem(StatusCodes.Status503ServiceUnavailable)]
    [HttpGet("{id:long:min(1)}/versions/{version:long:min(1)}")]
    public Task<ControlVersionResponse> Version(long id, long version, CancellationToken cancellationToken) =>
        controls.GetVersionAsync(id, version, cancellationToken);

    /// <summary>Checks a definition without storing anything and returns the engine's preview of it.</summary>
    [ProducesResponseType<JsonElement>(StatusCodes.Status200OK, "application/json")]
    [Problem(StatusCodes.Status422UnprocessableEntity)]
    [Problem(StatusCodes.Status503ServiceUnavailable)]
    [Problem(StatusCodes.Status413PayloadTooLarge)]
    [Problem(StatusCodes.Status415UnsupportedMediaType)]
    [HttpPost("validate")]
    public async Task<IResult> Validate(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] ValidateDefinitionRequest? request,
        CancellationToken cancellationToken) =>
        RawJson.Ok(await definitions.ValidateAsync(request, cancellationToken));
}
