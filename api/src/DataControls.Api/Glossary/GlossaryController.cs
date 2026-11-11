using System.Text.Json;
using DataControls.Api.Errors;
using DataControls.Api.Hosting;
using Microsoft.AspNetCore.Mvc;

namespace DataControls.Api.Glossary;

[ApiController]
[Route("api/v1/glossary")]
[Problem(StatusCodes.Status400BadRequest)]
[Problem(StatusCodes.Status500InternalServerError)]
public sealed class GlossaryController(GlossaryService glossary) : ControllerBase
{
    /// <summary>The engine's public glossary, unchanged.</summary>
    [ProducesResponseType<JsonElement>(StatusCodes.Status200OK, "application/json")]
    [Problem(StatusCodes.Status503ServiceUnavailable)]
    [HttpGet]
    public async Task<IResult> Get(CancellationToken cancellationToken) =>
        RawJson.Ok((await glossary.GetAsync(cancellationToken)).Body);
}
