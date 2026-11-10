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
    public void Positions_follow_the_json_text_when_a_member_is_written_after_its_siblings()
    {
        var positions = DefinitionDocument.PositionsOf(_definition);

        string[] inTextOrder = ["", "/rootEntity", "/where", "/where/type", "/where/children", "/where/children/0", "/where/children/0/id", "/where/children/1", "/where/children/1/where/children/0/left/path/0", "/where/op"];
        Assert.Equal(inTextOrder, inTextOrder.OrderBy(path => positions[path]));
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
