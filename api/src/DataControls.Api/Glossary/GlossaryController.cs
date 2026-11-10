using DataControls.Api.Hosting;
using Microsoft.AspNetCore.Mvc;

namespace DataControls.Api.Glossary;

[ApiController]
[Route("api/v1/glossary")]
public sealed class GlossaryController(GlossaryService glossary) : ControllerBase
{
    /// <summary>The engine's public glossary, unchanged.</summary>
    [HttpGet]
    public async Task<IResult> Get(CancellationToken cancellationToken) =>
        RawJson.Ok((await glossary.GetAsync(cancellationToken)).Body);
}
