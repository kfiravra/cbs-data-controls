namespace DataControls.Api.Engine;

/// <summary>The engine answers the api tells apart: the rows of "Engine failures" in <c>contracts/api.md</c>.</summary>
public enum EngineFailure
{
    /// <summary>422 <c>DEFINITION_INVALID</c>: the definition fails the glossary.</summary>
    DefinitionInvalid,

    /// <summary>504 <c>QUERY_TIMEOUT</c>: a statement ran past the engine's limit.</summary>
    QueryTimeout,

    /// <summary>503 <c>DATABASE_UNAVAILABLE</c>: the engine's database did not answer.</summary>
    DatabaseUnavailable,

    /// <summary>The engine was not reached, the attempt timed out, or the circuit is open.</summary>
    Unavailable,

    /// <summary>Anything else: another status, or a body that is not the contract's.</summary>
    Unexpected,
}
