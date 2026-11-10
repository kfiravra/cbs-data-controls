using System.Text.Json;
using DataControls.Api.Controls;

namespace DataControls.Api.Tests.Controls;

public sealed class DefinitionHasherTests
{
    private const string Reference = """{"b":[1,2.50,"x"],"a":{"d":null,"c":true}}""";

    [Fact]
    public void Hash_is_the_sha256_of_the_canonical_text_when_keys_are_out_of_order()
    {
        // Computed outside the code under test: sha256 of {"a":{"c":true,"d":null},"b":[1,2.50,"x"]}.
        const string expected = "b50e8f05d64cfe87f725b3049bfd923b8cf41f177eb6a7117fcf11d23e2edaf2";

        Assert.Equal("""{"a":{"c":true,"d":null},"b":[1,2.50,"x"]}""", DefinitionHasher.Canonical(Parse(Reference)));
        Assert.Equal(expected, DefinitionHasher.Hash(Parse(Reference)));
    }

    [Theory]
    [InlineData("""{"a":{"c":true,"d":null},"b":[1,2.50,"x"]}""")]
    [InlineData("""{ "b" : [ 1, 2.50, "x" ],   "a" : { "c" : true, "d" : null } }""")]
    [InlineData("{\"b\":[1,2.50,\"\\u0078\"],\"a\":{\"d\":null,\"c\":true}}")]
    public void Hash_is_equal_when_only_key_order_layout_or_the_spelling_of_a_string_differs(string other)
    {
        Assert.Equal(DefinitionHasher.Hash(Parse(Reference)), DefinitionHasher.Hash(Parse(other)));
    }

    [Theory]
    [InlineData("""{"b":[1,2.50,"y"],"a":{"d":null,"c":true}}""")]
    [InlineData("""{"b":[2.50,1,"x"],"a":{"d":null,"c":true}}""")]
    [InlineData("""{"b":[1,2.5,"x"],"a":{"d":null,"c":true}}""")]
    [InlineData("""{"b":[1,2.50,"x"],"a":{"d":null,"c":false}}""")]
    [InlineData("""{"b":[1,2.50,"x"],"a":{"d":null,"c":true},"e":1}""")]
    public void Hash_differs_when_a_value_a_list_order_a_number_spelling_or_a_member_differs(string other)
    {
        Assert.NotEqual(DefinitionHasher.Hash(Parse(Reference)), DefinitionHasher.Hash(Parse(other)));
    }

    [Fact]
    public void Stored_definition_is_minified_in_the_order_sent_with_its_root_entity_when_the_text_has_layout()
    {
        var stored = DefinitionHasher.ToStored(Parse("""
            {
              "schemaVersion": 1,
              "rootEntity": "department",
              "where": { "type": "group" }
            }
            """));

        Assert.Equal("""{"schemaVersion":1,"rootEntity":"department","where":{"type":"group"}}""", stored.Json);
        Assert.Equal("department", stored.RootEntity);
        Assert.Matches("^[0-9a-f]{64}$", stored.Hash);
    }

    private static JsonElement Parse(string json)
    {
        using var document = JsonDocument.Parse(json);
        return document.RootElement.Clone();
    }
}
