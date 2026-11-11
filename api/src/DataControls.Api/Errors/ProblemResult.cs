using Microsoft.AspNetCore.Mvc;

namespace DataControls.Api.Errors;

/// <summary>A problem returned from inside MVC, where a filter must hand back a result.</summary>
internal sealed class ProblemResult(ApiException problem) : IActionResult
{
    public Task ExecuteResultAsync(ActionContext context)
    {
        var http = context.HttpContext;
        return http.RequestServices.GetRequiredService<ProblemWriter>().WriteAsync(http, problem, http.RequestAborted);
    }
}
