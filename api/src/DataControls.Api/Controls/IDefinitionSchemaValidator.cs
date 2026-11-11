using System.Text.Json;
using DataControls.Api.Errors;

namespace DataControls.Api.Controls;

/// <summary>The api's own layer of definition checks: the schema version, then the shared JSON Schema.</summary>
public interface IDefinitionSchemaValidator
{
    /// <summary>
    /// The faults in document order, one per path; empty when the definition passes this layer, and also
    /// when the layer leaves it to the engine (a tree too large to evaluate here). Empty is therefore not
    /// "valid": only the engine's answer is.
    /// </summary>
    IReadOnlyList<DefinitionError> Validate(JsonElement definition);
}
