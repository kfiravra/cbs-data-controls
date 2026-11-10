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

    public async Task<ControlResponse> GetAsync(int id, CancellationToken cancellationToken)
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
    public async Task<ControlResponse> UpdateAsync(int id, UpdateControlRequest? request, CancellationToken cancellationToken)
    {
        var check = new RequestCheck();
        var input = ControlInput.Read(check, string.Empty, request?.Name, request?.Description, request?.Definition);
        var tokenText = check.Text("/concurrencyToken", request?.ConcurrencyToken, int.MaxValue);
        check.ThrowIfInvalid();

        var control = await FindAsync(id, cancellationToken);
        if (!control.IsActive)
        {
            throw ApiException.ControlArchived(id);
        }

        var token = ConcurrencyToken.Parse(tokenText)
            ?? throw ApiException.RequestInvalid("/concurrencyToken", RequestErrorCodes.Malformed);
        if (!token.AsSpan().SequenceEqual(control.RowVersion))
        {
            throw ApiException.ConcurrencyConflict(id);
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
            await SaveWithTokenAsync(control, token, cancellationToken);
        }

        return ToResponse(control, definitionJson);
    }

    /// <summary>Archives a control; a repeat changes nothing. Its versions and runs stay readable.</summary>
    public async Task ArchiveAsync(int id, CancellationToken cancellationToken)
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

        var controls = db.Controls.AsNoTracking();
        if (active != ActiveAndArchived)
        {
            var wanted = active == ActiveOnly;
            controls = controls.Where(control => control.IsActive == wanted);
        }

        var search = query.Search?.Trim();
        if (!string.IsNullOrEmpty(search))
        {
            // Contains is sent as a parameter with its wildcards escaped, so % and _ are taken literally.
            controls = controls.Where(control => control.Name.Contains(search));
        }

        if (!string.IsNullOrEmpty(query.RootEntity))
        {
            controls = controls.Where(control => control.RootEntityKey == query.RootEntity);
        }

        var total = await controls.CountAsync(cancellationToken);
        var rows = await controls
            .OrderBy(control => control.Name)
            .ThenBy(control => control.Id)
            .Skip(paging.Skip)
            .Take(paging.PageSize)
            .Select(control => new
            {
                Control = control,
                LastRun = db.Runs
                    .Where(run => run.ControlId == control.Id)
                    .OrderByDescending(run => run.StartedAt)
                    .ThenByDescending(run => run.Id)
                    .Select(run => new LastRunResponse(run.Id, run.StartedAt, run.Status, run.TotalCount))
                    .FirstOrDefault(),
            })
            .ToListAsync(cancellationToken);

        var items = rows.Select(row => new ControlSummaryResponse(
            row.Control.Id,
            row.Control.Name,
            row.Control.Description,
            row.Control.RootEntityKey,
            row.Control.CurrentVersion,
            row.Control.IsActive,
            row.Control.CreatedAt,
            row.Control.UpdatedAt,
            row.LastRun));
        return new PagedResponse<ControlSummaryResponse>([.. items], total, paging.Page, paging.PageSize);
    }

    public async Task<IReadOnlyList<ControlVersionSummaryResponse>> GetVersionsAsync(int id, CancellationToken cancellationToken)
    {
        await EnsureExistsAsync(id, cancellationToken);
        return await db.ControlVersions
            .AsNoTracking()
            .Where(version => version.ControlId == id)
            .OrderByDescending(version => version.Version)
            .Select(version => new ControlVersionSummaryResponse(version.Version, version.CreatedAt, version.DefinitionHash))
            .ToListAsync(cancellationToken);
    }

    public async Task<ControlVersionResponse> GetVersionAsync(int id, int version, CancellationToken cancellationToken)
    {
        await EnsureExistsAsync(id, cancellationToken);
        var found = await db.ControlVersions
            .AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.ControlId == id && candidate.Version == version, cancellationToken)
            ?? throw ApiException.VersionNotFound(id, version);
        return new ControlVersionResponse(found.Version, found.CreatedAt, StoredJson.Parse(found.Definition));
    }

    private async Task<Control> FindAsync(int id, CancellationToken cancellationToken) =>
        await db.Controls.SingleOrDefaultAsync(control => control.Id == id, cancellationToken)
        ?? throw ApiException.ControlNotFound(id);

    private async Task EnsureExistsAsync(int id, CancellationToken cancellationToken)
    {
        if (!await db.Controls.AnyAsync(control => control.Id == id, cancellationToken))
        {
            throw ApiException.ControlNotFound(id);
        }
    }

    private Task<ControlVersion> CurrentVersionAsync(Control control, CancellationToken cancellationToken) =>
        db.ControlVersions.SingleAsync(
            version => version.ControlId == control.Id && version.Version == control.CurrentVersion,
            cancellationToken);

    /// <summary>
    /// The client's token becomes the row version the UPDATE expects, so a save that lost a race after
    /// the check above is a conflict as well.
    /// </summary>
    private async Task SaveWithTokenAsync(Control control, byte[] token, CancellationToken cancellationToken)
    {
        db.Entry(control).Property(entity => entity.RowVersion).OriginalValue = token;
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
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
