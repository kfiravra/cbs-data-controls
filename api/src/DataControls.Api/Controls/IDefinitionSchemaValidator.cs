using System.Text.Json;
using DataControls.Api.Errors;

namespace DataControls.Api.Controls;

/// <summary>The api's own layer of definition checks: the schema version, then the shared JSON Schema.</summary>
public interface IDefinitionSchemaValidator
{
    /// <summary>The faults in document order, one per path; empty when the definition passes this layer.</summary>
    IReadOnlyList<DefinitionError> Validate(JsonElement definition);
}
