namespace TalentValley.Api.Storage;

public sealed class StorageOptions
{
    public const string SectionName = "Storage";
    public string RootPath { get; init; } = "storage";
}
