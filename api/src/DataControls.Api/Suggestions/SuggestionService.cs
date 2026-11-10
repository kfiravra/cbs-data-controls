using DataControls.Api.Controls;
using DataControls.Api.Engine;
using DataControls.Api.Errors;

namespace DataControls.Api.Suggestions;

/// <summary>
/// Suggestions are the engine's: the api asks and passes the answer on. Accepting some creates ordinary
/// controls through the controls module, all of them or none.
/// </summary>
public sealed class SuggestionService(EngineClient engine, ControlService controls)
{
    private const int MinItems = 1;
    private const int MaxItems = 20;

    /// <summary>The engine's <c>/suggest</c> body; nothing is stored or run.</summary>
    public Task<byte[]> SuggestAsync(SuggestionsRequest? request, CancellationToken cancellationToken)
    {
        var check = new RequestCheck();
        var max = check.AtLeast("/max", request?.Max, min: 1);
        check.ThrowIfInvalid();
        return engine.SuggestAsync(request?.RootEntity, max, cancellationToken);
    }

    public async Task<AcceptedControlsResponse> AcceptAsync(AcceptSuggestionsRequest? request, CancellationToken cancellationToken)
    {
        var check = new RequestCheck();
        var items = request?.Items;
        if (items is null)
        {
            check.Add("/items", RequestErrorCodes.Required);
        }
        else if (items.Count is < MinItems or > MaxItems)
        {
            check.Add("/items", RequestErrorCodes.OutOfRange, MinItems, MaxItems);
        }

        check.ThrowIfInvalid();
        return new AcceptedControlsResponse(await controls.CreateManyAsync(items ?? [], cancellationToken));
    }
}
