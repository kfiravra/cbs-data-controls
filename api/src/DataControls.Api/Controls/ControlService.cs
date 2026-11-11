using DataControls.Api.Errors;
using DataControls.Api.Hosting;
using DataControls.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DataControls.Api.Controls;

/// <summary>
/// Controls with immutable versions. A definition is checked by the schema and then by the engine before
/// anything is saved, and each change is one <c>SaveChanges</c>.
/// </summary>
public sealed class ControlService(DqDbContext db, DefinitionChecker definitions, UtcClock clock)
{
    private const string ActiveOnly = "true";
    private const string ArchivedOnly = "false";
    private const string ActiveAndArchived = "all";
    private const int MaxArchiveAttempts = 3;

    public async Task<ControlResponse> CreateAsync(CreateControlRequest? request, CancellationToken cancellationToken)
    {
        var check = new RequestCheck();
        var input = ControlInput.Read(check, string.Empty, request?.Name, request?.Description, request?.Definition);
        check.ThrowIfInvalid();

        await definitions.ValidateAsync(input.Definition, cancellationToken);
        var stored = DefinitionHasher.ToStored(input.Definition);
        var control = Control.Create(input.Name, input.Description, stored, clock.Now);
        db.Controls.Add(control);
        await db.SaveChangesAsync(cancellationToken);
        return ToResponse(control, stored.Json);
    }

    /// <summary>
    /// Creates several controls with one save: all of them or none. Every request fault is listed with the
    /// item's pointer; the first definition that fails answers with its index.
    /// </summary>
    public async Task<IReadOnlyList<ControlResponse>> CreateManyAsync(IReadOnlyList<CreateControlRequest?> requests, CancellationToken cancellationToken)
    {
        var check = new RequestCheck();
        var inputs = requests
            .Select((request, index) => ControlInput.Read(check, $"/items/{index}", request?.Name, request?.Description, request?.Definition))
            .ToList();
        check.ThrowIfInvalid();

        var now = clock.Now;
        var created = new List<(Control Control, StoredDefinition Definition)>();
        for (var index = 0; index < inputs.Count; index++)
        {
            await definitions.ValidateAsync(inputs[index].Definition, index, cancellationToken);
            var stored = DefinitionHasher.ToStored(inputs[index].Definition);
            created.Add((Control.Create(inputs[index].Name, inputs[index].Description, stored, now), stored));
        }

        db.Controls.AddRange(created.Select(item => item.Control));
        await db.SaveChangesAsync(cancellationToken);
        return [.. created.Select(item => ToResponse(item.Control, item.Definition.Json))];
    }

    public async Task<ControlResponse> GetAsync(long id, CancellationToken cancellationToken)
    {
        var control = await FindAsync(id, cancellationToken);
        var current = await CurrentVersionAsync(control, cancellationToken);
        return ToResponse(control, current.Definition);
    }

    /// <summary>
    /// Saves a control. The order is the contract's: the request, 404, archived, the token, the schema;
    /// the engine is asked only when the definition differs from the current version's, so a rename works
    /// while the engine is down. Nothing changed means nothing written.
    /// </summary>
    public async Task<ControlResponse> UpdateAsync(long id, UpdateControlRequest? request, CancellationToken cancellationToken)
    {
        var check = new RequestCheck();
        var input = ControlInput.Read(check, string.Empty, request?.Name, request?.Description, request?.Definition);
        var tokenText = check.Text("/concurrencyToken", request?.ConcurrencyToken, int.MaxValue);
        check.ThrowIfInvalid();

        var control = await FindAsync(id, cancellationToken);
        if (!control.IsActive)
        {
            throw ApiException.ControlArchived(control.Id);
        }

        var token = ConcurrencyToken.Parse(tokenText)
            ?? throw ApiException.RequestInvalid("/concurrencyToken", RequestErrorCodes.Malformed);
        if (!token.AsSpan().SequenceEqual(control.RowVersion))
        {
            throw ApiException.ConcurrencyConflict(control.Id);
        }

        definitions.CheckSchema(input.Definition);
        var stored = DefinitionHasher.ToStored(input.Definition);
        var current = await CurrentVersionAsync(control, cancellationToken);
        var now = clock.Now;
        var changed = control.Rename(input.Name, input.Description, now);
        var definitionJson = current.Definition;
        if (stored.Hash != current.DefinitionHash)
        {
            await definitions.AskEngineAsync(input.Definition, cancellationToken);
            control.AddVersion(stored, now);
            definitionJson = stored.Json;
            changed = true;
        }

        if (changed)
        {
            await SaveGuardedAsync(control, cancellationToken);
        }

        return ToResponse(control, definitionJson);
    }

    /// <summary>Archives a control; a repeat changes nothing. Its versions and runs stay readable.</summary>
    public async Task ArchiveAsync(long id, CancellationToken cancellationToken)
    {
        var control = await FindAsync(id, cancellationToken);
        for (var attempt = 1; control.Archive(clock.Now); attempt++)
        {
            try
            {
                await db.SaveChangesAsync(cancellationToken);
                return;
            }
            catch (DbUpdateConcurrencyException) when (attempt < MaxArchiveAttempts)
            {
                // Someone saved the control in between. An archive carries no token, so it is applied to
                // the row as it is now.
                await db.Entry(control).ReloadAsync(cancellationToken);
            }
        }
    }

    public async Task<PagedResponse<ControlSummaryResponse>> ListAsync(ControlListQuery query, CancellationToken cancellationToken)
    {
        var check = new RequestCheck();
        var paging = Paging.Read(check, query.Page, query.PageSize);
        var active = query.Active ?? ActiveOnly;
        if (active is not (ActiveOnly or ArchivedOnly or ActiveAndArchived))
        {
            check.Add("active", RequestErrorCodes.Malformed);
        }

        check.ThrowIfInvalid();

        var filtered = Filter(db.Controls.AsNoTracking(), active, query.Search?.Trim(), query.RootEntity);
        var total = await filtered.CountAsync(cancellationToken);
        var page = await filtered
            .OrderBy(control => control.Name)
            .ThenBy(control => control.Id)
            .Skip(paging.Skip)
            .Take(paging.PageSize)
            .ToListAsync(cancellationToken);
        var lastRuns = await LastRunsAsync([.. page.Select(control => control.Id)], cancellationToken);
        var items = page.Select(control => ToSummary(control, lastRuns.GetValueOrDefault(control.Id)));
        return new PagedResponse<ControlSummaryResponse>([.. items], total, paging.Page, paging.PageSize);
    }

    private static IQueryable<Control> Filter(IQueryable<Control> controls, string active, string? search, string? rootEntity)
    {
        if (active != ActiveAndArchived)
        {
            var wanted = active == ActiveOnly;
            controls = controls.Where(control => control.IsActive == wanted);
        }

        if (!string.IsNullOrEmpty(search))
        {
            // Contains is sent as a parameter with its wildcards escaped, so % and _ are taken literally.
            controls = controls.Where(control => control.Name.Contains(search));
        }

        if (!string.IsNullOrEmpty(rootEntity))
        {
            controls = controls.Where(control => control.RootEntityKey == rootEntity);
        }

        return controls;
    }

    /// <summary>
    /// The newest run of each control of one page, of any status. Asked only for the page's controls, so
    /// the index on <c>(control_id, started_at DESC)</c> is entered once per control and the rest of
    /// <c>dq.Run</c> is never read.
    /// </summary>
    private async Task<Dictionary<int, LastRunResponse>> LastRunsAsync(int[] controlIds, CancellationToken cancellationToken)
    {
        var newest = await db.Runs
            .AsNoTracking()
            .Where(run => controlIds.Contains(run.ControlId))
            .GroupBy(run => run.ControlId)
            .Select(runs => runs
                .OrderByDescending(run => run.StartedAt)
                .ThenByDescending(run => run.Id)
                .Select(run => new { run.ControlId, run.Id, run.StartedAt, run.Status, run.TotalCount })
                .First())
            .ToListAsync(cancellationToken);
        return newest.ToDictionary(run => run.ControlId, run => new LastRunResponse(run.Id, run.StartedAt, run.Status, run.TotalCount));
    }

    private static ControlSummaryResponse ToSummary(Control control, LastRunResponse? lastRun) =>
        new(
            control.Id,
            control.Name,
            control.Description,
            control.RootEntityKey,
            control.CurrentVersion,
            control.IsActive,
            control.CreatedAt,
            control.UpdatedAt,
            lastRun);

    public async Task<IReadOnlyList<ControlVersionSummaryResponse>> GetVersionsAsync(long id, CancellationToken cancellationToken)
    {
        var controlId = await ExistingIdAsync(id, cancellationToken);
        return await db.ControlVersions
            .AsNoTracking()
            .Where(version => version.ControlId == controlId)
            .OrderByDescending(version => version.Version)
            .Select(version => new ControlVersionSummaryResponse(version.Version, version.CreatedAt, version.DefinitionHash))
            .ToListAsync(cancellationToken);
    }

    public async Task<ControlVersionResponse> GetVersionAsync(long id, long version, CancellationToken cancellationToken)
    {
        var controlId = await ExistingIdAsync(id, cancellationToken);
        var found = version > int.MaxValue
            ? null
            : await db.ControlVersions
                .AsNoTracking()
                .SingleOrDefaultAsync(candidate => candidate.ControlId == controlId && candidate.Version == version, cancellationToken);
        return found is null
            ? throw ApiException.VersionNotFound(id, version)
            : new ControlVersionResponse(found.Version, found.CreatedAt, StoredJson.Parse(found.Definition));
    }

    /// <summary>
    /// An id is a positive integer of any size in the path, and a column of 32 bits in the table: one that
    /// cannot be a key names no control, which is the same answer as a key that has no row.
    /// </summary>
    private static int? KeyOf(long id) => id <= int.MaxValue ? (int)id : null;

    private async Task<Control> FindAsync(long id, CancellationToken cancellationToken)
    {
        var control = KeyOf(id) is { } key
            ? await db.Controls.SingleOrDefaultAsync(candidate => candidate.Id == key, cancellationToken)
            : null;
        return control ?? throw ApiException.ControlNotFound(id);
    }

    private async Task<int> ExistingIdAsync(long id, CancellationToken cancellationToken) =>
        KeyOf(id) is { } key && await db.Controls.AnyAsync(control => control.Id == key, cancellationToken)
            ? key
            : throw ApiException.ControlNotFound(id);

    private Task<ControlVersion> CurrentVersionAsync(Control control, CancellationToken cancellationToken) =>
        db.ControlVersions.SingleAsync(
            version => version.ControlId == control.Id && version.Version == control.CurrentVersion,
            cancellationToken);

    /// <summary>
    /// Saves a control whose token was just checked. The UPDATE carries the row version that was read, so a
    /// save that lost a race after the check finds no row; and when both saves add the same version number,
    /// the second insert meets the first one's key. Both are a conflict.
    /// </summary>
    private async Task SaveGuardedAsync(Control control, CancellationToken cancellationToken)
    {
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw ApiException.ConcurrencyConflict(control.Id);
        }
        catch (DbUpdateException failure) when (SqlFailure.IsDuplicateKey(failure))
        {
            throw ApiException.ConcurrencyConflict(control.Id);
        }
    }

    private static ControlResponse ToResponse(Control control, string definitionJson) =>
        new(
            control.Id,
            control.Name,
            control.Description,
            control.RootEntityKey,
            control.CurrentVersion,
            control.IsActive,
            control.CreatedAt,
            control.UpdatedAt,
            ConcurrencyToken.From(control.RowVersion),
            StoredJson.Parse(definitionJson));
}
