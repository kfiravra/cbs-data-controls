using System.Text.Json;
using DataControls.Api.Engine;
using DataControls.Api.Errors;

namespace DataControls.Api.Controls;

/// <summary>
/// The two layers a definition passes before anything is saved: the api's own (the schema, answered
/// without calling the engine) and the engine's <c>/validate</c> (the glossary).
/// </summary>
public sealed class DefinitionChecker(IDefinitionSchemaValidator schema, EngineClient engine)
{
    /// <summary>A dry check of a request's definition; returns the engine's <c>/validate</c> body.</summary>
    public Task<byte[]> ValidateAsync(ValidateDefinitionRequest? request, CancellationToken cancellationToken)
    {
        var check = new RequestCheck();
        var definition = check.Definition("/definition", request?.Definition);
        check.ThrowIfInvalid();
        return ValidateAsync(definition, cancellationToken);
    }

    /// <summary>Both layers, for the one definition of a request.</summary>
    public Task<byte[]> ValidateAsync(JsonElement definition, CancellationToken cancellationToken) =>
        ValidateAsync(definition, index: null, cancellationToken);

    /// <summary>
    /// Both layers. A rejection by either is a 422 problem; when the definition is one of several in the
    /// request, <paramref name="index"/> says which. Any other engine failure is an <see cref="EngineException"/>.
    /// </summary>
    public async Task<byte[]> ValidateAsync(JsonElement definition, int? index, CancellationToken cancellationToken)
    {
        CheckSchema(definition, index);
        try
        {
            return await AskEngineAsync(definition, cancellationToken);
        }
        catch (EngineException failure) when (index is not null && failure.Failure == EngineFailure.DefinitionInvalid)
        {
            throw EngineErrorMap.ToProblem(failure, index);
        }
    }

    /// <summary>The engine's layer alone, for a definition that already passed the schema.</summary>
    public Task<byte[]> AskEngineAsync(JsonElement definition, CancellationToken cancellationToken) =>
        engine.ValidateAsync(definition, cancellationToken);

    /// <summary>The api's own layer alone.</summary>
    public void CheckSchema(JsonElement definition, int? index = null)
    {
        var errors = schema.Validate(definition);
        if (errors.Count > 0)
        {
            throw ApiException.DefinitionInvalid(errors, index);
        }
    }
}
