using DataControls.Api.Errors;

namespace DataControls.Api.Tests.Errors;

public sealed class ModelStateErrorsTests
{
    [Theory]
    [InlineData("$", "")]
    [InlineData("$.name", "/name")]
    [InlineData("$.items[2].name", "/items/2/name")]
    [InlineData("$.definition.where.children[0]", "/definition/where/children/0")]
    [InlineData("pageSize", "pageSize")]
    [InlineData("", "")]
    public void Key_becomes_a_json_pointer_when_it_is_a_json_path_and_stays_when_it_is_a_parameter_name(string key, string expected)
    {
        Assert.Equal(expected, ModelStateErrors.ToPath(key));
    }
}
