using System.Text.Json;
using DataControls.Api.Runs;

namespace DataControls.Api.Tests.Runs;

/// <summary>The rule of <c>display_text</c> in <c>contracts/api.md</c> (Violation), value by value.</summary>
public sealed class DisplayTextTests
{
    private static readonly string[] _fields = ["name", "number", "flag", "date", "missing"];

    [Fact]
    public void Display_text_joins_the_values_in_the_identifying_order_when_the_object_has_another_order()
    {
        var display = Parse("""{"date":"2026-11-01","flag":true,"number":1051,"name":"Ada"}""");

        Assert.Equal("Ada 1051 true 2026-11-01", DisplayText.Of(display, _fields));
    }

    [Fact]
    public void Display_text_keeps_the_order_written_when_the_identifying_fields_are_not_known()
    {
        var display = Parse("""{"date":"2026-11-01","flag":false,"number":1051,"name":"Ada"}""");

        Assert.Equal("2026-11-01 false 1051 Ada", DisplayText.Of(display, null));
    }

    [Fact]
    public void Display_text_leaves_a_null_out_and_writes_a_number_as_json_has_it()
    {
        var display = Parse("""{"name":null,"number":15000.50,"flag":false,"date":null}""");

        Assert.Equal("15000.50 false", DisplayText.Of(display, _fields));
    }

    [Fact]
    public void Display_text_ignores_a_member_that_is_not_an_identifying_field()
    {
        var display = Parse("""{"name":"Ada","salary":9000}""");

        Assert.Equal("Ada", DisplayText.Of(display, _fields));
    }

    [Fact]
    public void Display_text_is_cut_to_400_characters_when_the_values_are_longer()
    {
        var display = Parse($$"""{"name":"{{new string('a', 399)}}","number":123}""");

        var text = DisplayText.Of(display, _fields);

        Assert.Equal(400, text.Length);
        Assert.EndsWith("a ", text);
    }

    [Fact]
    public void Display_text_is_cut_before_a_surrogate_pair_when_the_cut_would_split_it()
    {
        // 399 letters, then one character outside the basic plane: its two halves sit at 399 and 400.
        var display = Parse("{\"name\":\"" + new string('a', 399) + char.ConvertFromUtf32(0x1F600) + "\"}");

        var text = DisplayText.Of(display, _fields);

        Assert.Equal(new string('a', 399), text);
    }

    private static JsonElement Parse(string json)
    {
        using var document = JsonDocument.Parse(json);
        return document.RootElement.Clone();
    }
}
