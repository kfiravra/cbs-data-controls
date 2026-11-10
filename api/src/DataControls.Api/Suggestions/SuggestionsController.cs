using System.Text.Json;
using DataControls.Api.Controls;
using DataControls.Api.Errors;
using DataControls.Api.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace DataControls.Api.Suggestions;

[ApiController]
[Route("api/v1/suggestions")]
[Problem(StatusCodes.Status400BadRequest)]
[Problem(StatusCodes.Status500InternalServerError)]
public sealed class SuggestionsController(SuggestionService suggestions) : ControllerBase
{
    /// <summary>Asks the engine for controls worth having: heuristics over the glossary and the data.</summary>
    [ProducesResponseType<JsonElement>(StatusCodes.Status200OK, "application/json")]
    [Problem(StatusCodes.Status503ServiceUnavailable)]
    [Problem(StatusCodes.Status504GatewayTimeout)]
    [HttpPost]
    public async Task<IResult> Suggest(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] SuggestionsRequest? request,
        CancellationToken cancellationToken) =>
        RawJson.Ok(await suggestions.SuggestAsync(request, cancellationToken));

    /// <summary>Creates a control from each accepted suggestion: all of them, or none.</summary>
    [ProducesResponseType<AcceptedControlsResponse>(StatusCodes.Status201Created)]
    [Problem(StatusCodes.Status422UnprocessableEntity)]
    [Problem(StatusCodes.Status503ServiceUnavailable)]
    [HttpPost("accept")]
    public async Task<IActionResult> Accept(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] AcceptSuggestionsRequest? request,
        CancellationToken cancellationToken)
    {
        var accepted = await suggestions.AcceptAsync(request, cancellationToken);
        return Created(ControlsController.Location(accepted.Items[0].Id), accepted);
    }
}
