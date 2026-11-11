using Microsoft.AspNetCore.Mvc;

namespace DataControls.Api.Health;

[ApiController]
[Route("api/v1/health")]
public sealed class HealthController(HealthService health) : ControllerBase
{
    /// <summary>Always 200: what is down is in the body.</summary>
    [ProducesResponseType(StatusCodes.Status200OK)]
    [HttpGet]
    public Task<HealthResponse> Get(CancellationToken cancellationToken) => health.CheckAsync(cancellationToken);
}
