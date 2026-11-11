using DataControls.Api.Controls;

namespace DataControls.Api.Tests.Controls;

/// <summary>
/// The corrections that make JsonSchema.Net's error units say what the contract asks for. The units are
/// the ones the probe recorded on the real schema (<c>dev/active/dc-api/research/schema-probe.md</c>).
/// </summary>
public sealed class SchemaErrorPathsTests
{
    private const string Node = "/where/children/0";

    [Fact]
    public void Unit_is_dropped_when_its_evaluation_path_goes_through_an_if()
    {
        SchemaErrorUnit[] units =
        [
            new($"{Node}/type", "/properties/where/$ref/$ref/properties/children/items/items/$ref/allOf/0/if/properties/type", false),
            new(Node, "/properties/where/$ref/$ref/properties/children/items/items/$ref/allOf/5/if", false),
        ];

        Assert.Empty(SchemaErrorPaths.From(units));
    }

    [Theory]
    [InlineData("/properties/where/$ref/not/required")]
    [InlineData("/properties/where/$ref/anyOf/0/required")]
    [InlineData("/properties/where/$ref/oneOf/1/properties/type")]
    public void Unit_is_dropped_when_its_evaluation_path_goes_through_a_not_an_anyOf_or_a_oneOf(string evaluationPath)
    {
        Assert.Empty(SchemaErrorPaths.From([new SchemaErrorUnit(Node, evaluationPath, false)]));
    }

    [Fact]
    public void Unit_is_kept_when_a_property_is_merely_named_like_a_test_keyword()
    {
        var paths = SchemaErrorPaths.From([new SchemaErrorUnit("/if", "/properties/if/type", false)]);

        Assert.Equal(["/if"], paths);
    }

    [Theory]
    [InlineData("/where/children/0/value", "/where/children/0")]
    [InlineData("/where/children/0/left/extra", "/where/children/0/left")]
    [InlineData("/extra", "")]
    public void Path_is_the_object_when_a_false_subschema_forbids_one_of_its_members(string member, string expected)
    {
        var paths = SchemaErrorPaths.From([new SchemaErrorUnit(member, "/properties/where/$ref/allOf/3/then/properties/value", true)]);

        Assert.Equal([expected], paths);
    }

    [Fact]
    public void Path_is_the_instance_location_when_a_keyword_fails_on_a_value()
    {
        var paths = SchemaErrorPaths.From([new SchemaErrorUnit($"{Node}/values", "/properties/where/$ref/allOf/7/then/properties/values", false)]);

        Assert.Equal([$"{Node}/values"], paths);
    }

    [Fact]
    public void Path_is_listed_once_when_two_units_end_at_the_same_location()
    {
        SchemaErrorUnit[] units =
        [
            new($"{Node}/value", "/x/allOf/3/then/properties/value", true),
            new(Node, "/x/allOf/1/then", false),
        ];

        Assert.Equal([Node], SchemaErrorPaths.From(units));
    }
}
