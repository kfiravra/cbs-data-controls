namespace DataControls.Api.Controls;

/// <summary>
/// One unit of the validator's list output that carries an error: where in the definition, through which
/// schema keywords, and whether a <c>false</c> subschema raised it.
/// </summary>
internal readonly record struct SchemaErrorUnit(string InstanceLocation, string EvaluationPath, bool FromFalseSchema);
