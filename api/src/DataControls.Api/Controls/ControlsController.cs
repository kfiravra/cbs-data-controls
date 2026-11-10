using DataControls.Api.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace DataControls.Api.Controls;

[ApiController]
[Route("api/v1/controls")]
public sealed class ControlsController(DefinitionChecker definitions) : ControllerBase
{
    /// <summary>Checks a definition without storing anything and returns the engine's preview of it.</summary>
    [HttpPost("validate")]
    public async Task<IResult> Validate(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] ValidateDefinitionRequest? request,
        CancellationToken cancellationToken) =>
        RawJson.Ok(await definitions.ValidateAsync(request, cancellationToken));
}
