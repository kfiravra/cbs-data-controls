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

    /// <summary>Both layers. Throws 422 from the schema; an engine failure is an <see cref="EngineException"/>.</summary>
    public Task<byte[]> ValidateAsync(JsonElement definition, CancellationToken cancellationToken)
    {
        CheckSchema(definition);
        return engine.ValidateAsync(definition, cancellationToken);
    }

    /// <summary>The api's own layer alone.</summary>
    public void CheckSchema(JsonElement definition)
    {
        var errors = schema.Validate(definition);
        if (errors.Count > 0)
        {
            throw ApiException.DefinitionInvalid(errors);
        }
    }
}
