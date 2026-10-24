using System.IO.Compression;
using System.Text;

namespace TalentValley.Api.Tests;

// Builds fictional LinkedIn export ZIPs in memory. Never use data of real people in tests.
internal static class LinkedInZipBuilder
{
    public static byte[] Build(params (string Name, string Content)[] entries) =>
        BuildFromBytes(entries.Select(entry => (entry.Name, Encoding.UTF8.GetBytes(entry.Content))).ToArray());

    public static byte[] BuildFromBytes(params (string Name, byte[] Content)[] entries)
    {
        using var output = new MemoryStream();
        using (var archive = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var (name, content) in entries)
            {
                using var stream = archive.CreateEntry(name, CompressionLevel.Optimal).Open();
                stream.Write(content);
            }
        }

        return output.ToArray();
    }

    public static MemoryStream Stream(byte[] zip) => new(zip);
}
