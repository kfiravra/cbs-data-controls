using DataControls.Api.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace DataControls.Api.Controls;

[ApiController]
[Route("api/v1/controls")]
public sealed class ControlsController(ControlService controls, DefinitionChecker definitions) : ControllerBase
{
    /// <summary>The controls, ordered by name: active ones unless <c>active</c> is <c>false</c> or <c>all</c>.</summary>
    [HttpGet]
    public Task<PagedResponse<ControlSummaryResponse>> List(
        string? search,
        string? rootEntity,
        string? active,
        int? page,
        int? pageSize,
        CancellationToken cancellationToken) =>
        controls.ListAsync(new ControlListQuery(search, rootEntity, active, page, pageSize), cancellationToken);

    /// <summary>Creates a control with version 1, after the schema and the engine have accepted its definition.</summary>
    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] CreateControlRequest? request,
        CancellationToken cancellationToken)
    {
        var control = await controls.CreateAsync(request, cancellationToken);
        return Created(Location(control.Id), control);
    }

    [HttpGet("{id:long:min(1)}")]
    public Task<ControlResponse> Get(long id, CancellationToken cancellationToken) =>
        controls.GetAsync(id, cancellationToken);

    /// <summary>Saves a control; a changed definition becomes a new version.</summary>
    [HttpPut("{id:long:min(1)}")]
    public Task<ControlResponse> Update(
        long id,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] UpdateControlRequest? request,
        CancellationToken cancellationToken) =>
        controls.UpdateAsync(id, request, cancellationToken);

    /// <summary>Archives the control. Its versions and runs stay readable.</summary>
    [HttpDelete("{id:long:min(1)}")]
    public async Task<IActionResult> Archive(long id, CancellationToken cancellationToken)
    {
        await controls.ArchiveAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpGet("{id:long:min(1)}/versions")]
    public Task<IReadOnlyList<ControlVersionSummaryResponse>> Versions(long id, CancellationToken cancellationToken) =>
        controls.GetVersionsAsync(id, cancellationToken);

    [HttpGet("{id:long:min(1)}/versions/{version:long:min(1)}")]
    public Task<ControlVersionResponse> Version(long id, long version, CancellationToken cancellationToken) =>
        controls.GetVersionAsync(id, version, cancellationToken);

    /// <summary>Checks a definition without storing anything and returns the engine's preview of it.</summary>
    [HttpPost("validate")]
    public async Task<IResult> Validate(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] ValidateDefinitionRequest? request,
        CancellationToken cancellationToken) =>
        RawJson.Ok(await definitions.ValidateAsync(request, cancellationToken));

    internal static string Location(int id) => $"/api/v1/controls/{id}";
}
