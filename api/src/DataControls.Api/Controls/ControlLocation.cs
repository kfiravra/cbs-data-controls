namespace DataControls.Api.Controls;

/// <summary>The path of a control, for the <c>Location</c> of a response that created one.</summary>
internal static class ControlLocation
{
    public static string Of(int id) => $"/api/v1/controls/{id}";
}
