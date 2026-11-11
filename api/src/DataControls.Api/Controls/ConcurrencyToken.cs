namespace DataControls.Api.Controls;

/// <summary>The token a client sends back on save: the base64 of the control's row version, opaque to it.</summary>
internal static class ConcurrencyToken
{
    private const int RowVersionBytes = 8;

    public static string From(byte[] rowVersion) => Convert.ToBase64String(rowVersion);

    /// <summary>The row version a token stands for, or null when the text is not a token.</summary>
    public static byte[]? Parse(string token)
    {
        var bytes = new byte[RowVersionBytes];
        return Convert.TryFromBase64String(token, bytes, out var written) && written == RowVersionBytes ? bytes : null;
    }
}
