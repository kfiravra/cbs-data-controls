using System.Text.Json;
using DataControls.Api.Controls;

namespace DataControls.Api.Tests.Controls;

public sealed class DefinitionDocumentTests
{
    private const string Nested = """
        {
          "rootEntity": "department",
          "where": {
            "type": "group",
            "children": [
              { "type": "condition", "id": "c1", "left": { "field": "is_active" } },
              { "type": "related", "id": "r1", "where": { "type": "group", "children": [ { "type": "condition", "id": "c2", "left": { "path": ["a"], "field": "status" } } ] } }
            ],
            "op": "and"
          }
        }
        """;

    private static readonly JsonElement _definition = Parse(Nested);

    [Fact]
    public void Located_pointers_follow_the_json_text_when_a_member_is_written_after_its_siblings()
    {
        string[] inTextOrder = ["", "/rootEntity", "/where", "/where/type", "/where/children", "/where/children/0", "/where/children/0/id", "/where/children/1", "/where/children/1/where/children/0/left/path/0", "/where/op"];

        var located = DefinitionDocument.Locate(_definition, inTextOrder.Reverse());

        Assert.Equal(inTextOrder, located.Select(entry => entry.Pointer));
    }

    [Fact]
    public void Located_pointers_carry_their_node_ids_and_come_once_when_one_is_given_twice()
    {
        var located = DefinitionDocument.Locate(_definition, ["/where/op", "/where/children/1/where/children/0", "/where/children/0/left", "/where/op"]);

        Assert.Equal(
            [("/where/children/0/left", "c1"), ("/where/children/1/where/children/0", "c2"), ("/where/op", null)],
            located);
    }

    [Fact]
    public void Located_pointers_end_with_the_ones_that_lead_nowhere_each_with_the_node_above_where_it_left()
    {
        var located = DefinitionDocument.Locate(
            _definition,
            ["/where/missing/0", "/where/children/1/relationship/x", "/where/children/7", "/where/children/01", "/where/op/deeper", "/where"]);

        Assert.Equal(
            [("/where", null), ("/where/missing/0", null), ("/where/children/1/relationship/x", "r1"), ("/where/children/7", null), ("/where/children/01", null), ("/where/op/deeper", null)],
            located);
    }

    [Fact]
    public void Located_pointer_reads_a_member_whose_name_holds_a_slash_or_a_tilde()
    {
        var definition = Parse("""{"where":{"type":"group","id":"g1","a/b":{"c~d":1}}}""");

        var located = DefinitionDocument.Locate(definition, ["/where/a~1b/c~0d"]);

        Assert.Equal([("/where/a~1b/c~0d", "g1")], located);
    }

    [Fact]
    public void Located_pointer_reads_the_member_written_last_when_a_name_is_written_twice()
    {
        var definition = Parse("""{"where":{"type":"group","id":"first"},"rootEntity":"employee","where":{"type":"group","id":"last","op":"and"}}""");

        var located = DefinitionDocument.Locate(definition, ["/where/op", "/rootEntity"]);

        Assert.Equal([("/rootEntity", null), ("/where/op", "last")], located);
    }

    [Fact]
    public void Locating_costs_the_size_of_the_definition_when_a_long_member_name_holds_a_wide_array()
    {
        // A pointer per element would be 20,000 pointers of 20,000 characters each: 800 MB.
        var definition = Parse($$"""{"schemaVersion":1,"{{new string('a', 20_000)}}":[{{string.Join(',', Enumerable.Repeat("0", 20_000))}}]}""");
        var before = GC.GetAllocatedBytesForCurrentThread();

        var located = DefinitionDocument.Locate(definition, [string.Empty]);

        Assert.Equal([(string.Empty, null)], located);
        Assert.InRange(GC.GetAllocatedBytesForCurrentThread() - before, 0, 1024 * 1024);
    }

    [Theory]
    [InlineData("", null)]
    [InlineData("/rootEntity", null)]
    [InlineData("/where", null)]
    [InlineData("/where/op", null)]
    [InlineData("/where/children/0", "c1")]
    [InlineData("/where/children/0/left", "c1")]
    [InlineData("/where/children/1/relationship", "r1")]
    [InlineData("/where/children/1/where", "r1")]
    [InlineData("/where/children/1/where/op", "r1")]
    [InlineData("/where/children/1/where/children/0", "c2")]
    [InlineData("/where/children/1/where/children/0/left/path", "c2")]
    public void Nearest_node_id_is_the_closest_id_at_or_above_the_path_when_there_is_one(string path, string? expected)
    {
        Assert.Equal(expected, DefinitionDocument.NearestNodeId(_definition, path));
    }

    [Theory]
    [InlineData("/where/children/0/left")]
    [InlineData("/where/children/0/left/field")]
    [InlineData("/rootEntity")]
    [InlineData("/where/op")]
    public void Nearest_node_id_ignores_an_id_on_the_definition_or_inside_a_field_reference(string path)
    {
        var definition = Parse("""{"id":"root","rootEntity":"employee","where":{"type":"group","op":"and","children":[{"type":"condition","left":{"id":"fieldref","field":"age"}}]}}""");

        Assert.Null(DefinitionDocument.NearestNodeId(definition, path));
    }

    [Fact]
    public void Nearest_node_id_ignores_an_id_that_is_not_a_string()
    {
        var definition = Parse("""{"where":{"type":"group","children":[{"type":"condition","id":7,"left":{}}]}}""");

        Assert.Null(DefinitionDocument.NearestNodeId(definition, "/where/children/0/left"));
    }

    private static JsonElement Parse(string json)
    {
        using var document = JsonDocument.Parse(json);
        return document.RootElement.Clone();
    }
}
