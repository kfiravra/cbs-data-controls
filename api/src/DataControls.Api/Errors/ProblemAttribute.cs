using Microsoft.AspNetCore.Mvc;

namespace DataControls.Api.Errors;

/// <summary>Documents a status an action may answer with a problem.</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class ProblemAttribute(int status)
    : ProducesResponseTypeAttribute(typeof(ProblemResponse), status, "application/problem+json");
