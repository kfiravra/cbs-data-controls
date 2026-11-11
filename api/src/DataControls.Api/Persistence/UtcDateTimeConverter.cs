using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace DataControls.Api.Persistence;

/// <summary>
/// <c>datetime2</c> comes back with an unspecified kind and would be written without <c>Z</c>. Every
/// timestamp of <c>dq</c> is UTC, so the kind is set on the way out.
/// </summary>
internal sealed class UtcDateTimeConverter() : ValueConverter<DateTime, DateTime>(
    value => value,
    value => DateTime.SpecifyKind(value, DateTimeKind.Utc));
