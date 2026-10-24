using System.IO.Compression;
using System.Text;
using TalentValley.Api.Storage;

namespace TalentValley.Api.Services;

// Reads the ZIP from LinkedIn's "Get a copy of your data" entirely in memory (nothing is written to disk).
// Only the CSV files listed below are ever opened; every other entry in the archive is ignored unread.
// The caller must validate the upload first (FileUploadValidator, UploadKind.Zip).
public sealed class LinkedInExportReader
{
    public const int MaxEntries = 500;
    public const long MaxEntryBytes = 5L * 1024 * 1024;
    public const long MaxTotalBytes = 15L * 1024 * 1024;

    private const int ReadChunkBytes = 8192;
    private const string TooLargeMessage = "The ZIP file content is too large.";

    private const string ProfileFile = "Profile.csv";
    private const string PositionsFile = "Positions.csv";
    private const string EducationFile = "Education.csv";
    private const string CertificationsFile = "Certifications.csv";
    private const string SkillsFile = "Skills.csv";
    private const string LanguagesFile = "Languages.csv";
    private const string ProjectsFile = "Projects.csv";
    private const string EmailsFile = "Email Addresses.csv";
    private const string PhonesFile = "PhoneNumbers.csv";

    private const string NameColumn = "Name";
    private const string StartColumn = "Started On";
    private const string EndColumn = "Finished On";

    private static readonly HashSet<string> ExpectedFiles = new(StringComparer.OrdinalIgnoreCase)
    {
        ProfileFile, PositionsFile, EducationFile, CertificationsFile, SkillsFile, LanguagesFile, ProjectsFile,
        EmailsFile, PhonesFile
    };

    public LinkedInImportedData Read(Stream zip)
    {
        try
        {
            using var archive = new ZipArchive(zip, ZipArchiveMode.Read, leaveOpen: true);
            return Build(LoadExpectedFiles(archive));
        }
        catch (Exception exception) when (exception is InvalidDataException or NotSupportedException)
        {
            throw new UploadValidationException("The ZIP file is invalid or unsupported.");
        }
    }

    private static Dictionary<string, string> LoadExpectedFiles(ZipArchive archive)
    {
        if (archive.Entries.Count > MaxEntries)
            throw new UploadValidationException("The ZIP file contains too many entries.");

        var files = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        long totalBytes = 0;
        foreach (var entry in archive.Entries)
        {
            var name = entry.FullName.Replace('\\', '/');
            if (IsUnsafePath(name))
                throw new UploadValidationException("The ZIP file contains an invalid entry path.");
            if (!ExpectedFiles.Contains(name)) continue;
            if (files.ContainsKey(name))
                throw new UploadValidationException("The ZIP file contains a repeated entry.");

            if (entry.IsEncrypted)
                throw new UploadValidationException("The ZIP file is encrypted.");

            var content = ReadEntry(entry);
            totalBytes += content.Length;
            if (totalBytes > MaxTotalBytes)
                throw new UploadValidationException(TooLargeMessage);
            files.Add(name, Encoding.UTF8.GetString(content));
        }

        return files;
    }

    private static bool IsUnsafePath(string path) =>
        path.StartsWith('/')
        || (path.Length > 1 && path[1] == ':')
        || path.Split('/').Contains("..");

    // The runtime already stops reading at the size written in the ZIP header; the bytes actually produced
    // are counted as well, as a second barrier.
    private static byte[] ReadEntry(ZipArchiveEntry entry)
    {
        if (entry.Length > MaxEntryBytes)
            throw new UploadValidationException(TooLargeMessage);

        using var source = entry.Open();
        using var buffer = new MemoryStream();
        var chunk = new byte[ReadChunkBytes];
        int read;
        while ((read = source.Read(chunk, 0, chunk.Length)) > 0)
        {
            if (buffer.Length + read > MaxEntryBytes)
                throw new UploadValidationException(TooLargeMessage);
            buffer.Write(chunk, 0, read);
        }

        return buffer.ToArray();
    }

    private static LinkedInImportedData Build(Dictionary<string, string> files)
    {
        var profileRows = Rows(files, ProfileFile);
        var profile = profileRows.Count > 0 ? profileRows[0] : null;
        return new LinkedInImportedData(
            new LinkedInContato(Field(profile, "Geo Location"), ParseSites(Field(profile, "Websites")),
                ReadEmails(Rows(files, EmailsFile)), ReadTelefones(Rows(files, PhonesFile))),
            Field(profile, "Summary"),
            ReadExperiencias(Rows(files, PositionsFile)),
            ReadFormacoes(Rows(files, EducationFile)),
            ReadCertificacoes(Rows(files, CertificationsFile)),
            ReadCompetencias(Rows(files, SkillsFile)),
            ReadIdiomas(Rows(files, LanguagesFile)),
            ReadProjetos(Rows(files, ProjectsFile)));
    }

    private static IReadOnlyList<IReadOnlyDictionary<string, string>> Rows(Dictionary<string, string> files, string file) =>
        files.TryGetValue(file, out var text) ? CsvParser.ParseTable(text) : [];

    private static string? Field(IReadOnlyDictionary<string, string>? row, string column) =>
        row is not null && row.TryGetValue(column, out var value) && !string.IsNullOrWhiteSpace(value)
            ? value.Trim()
            : null;

    private static List<LinkedInExperiencia> ReadExperiencias(IReadOnlyList<IReadOnlyDictionary<string, string>> rows) =>
        rows.Select(row => new LinkedInExperiencia(Field(row, "Company Name"), Field(row, "Title"),
                Field(row, "Description"), Field(row, "Location"), Field(row, StartColumn), Field(row, EndColumn)))
            .Where(item => item.Empresa is not null || item.Cargo is not null)
            .ToList();

    private static List<LinkedInFormacao> ReadFormacoes(IReadOnlyList<IReadOnlyDictionary<string, string>> rows) =>
        rows.Select(row => (Instituicao: Field(row, "School Name"), Row: row))
            .Where(item => item.Instituicao is not null)
            .Select(item => new LinkedInFormacao(item.Instituicao!, Field(item.Row, "Degree Name"),
                Field(item.Row, "Notes"), Field(item.Row, "Start Date"), Field(item.Row, "End Date")))
            .ToList();

    private static List<LinkedInCertificacao> ReadCertificacoes(IReadOnlyList<IReadOnlyDictionary<string, string>> rows) =>
        rows.Select(row => (Nome: Field(row, NameColumn), Row: row))
            .Where(item => item.Nome is not null)
            .Select(item => new LinkedInCertificacao(item.Nome!, Field(item.Row, "Authority"),
                Field(item.Row, StartColumn), Field(item.Row, EndColumn)))
            .ToList();

    private static List<string> ReadCompetencias(IReadOnlyList<IReadOnlyDictionary<string, string>> rows) =>
        rows.Select(row => Field(row, NameColumn))
            .OfType<string>()
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

    private static List<LinkedInIdioma> ReadIdiomas(IReadOnlyList<IReadOnlyDictionary<string, string>> rows) =>
        rows.Select(row => (Nome: Field(row, NameColumn), Row: row))
            .Where(item => item.Nome is not null)
            .Select(item => new LinkedInIdioma(item.Nome!, Field(item.Row, "Proficiency")))
            .ToList();

    private static List<LinkedInProjeto> ReadProjetos(IReadOnlyList<IReadOnlyDictionary<string, string>> rows) =>
        rows.Select(row => (Titulo: Field(row, "Title"), Row: row))
            .Where(item => item.Titulo is not null)
            .Select(item => new LinkedInProjeto(item.Titulo!, Field(item.Row, "Description"),
                Field(item.Row, StartColumn), Field(item.Row, EndColumn)))
            .ToList();

    private static List<LinkedInEmail> ReadEmails(IReadOnlyList<IReadOnlyDictionary<string, string>> rows) =>
        rows.Select(row => (Endereco: Field(row, "Email Address"), Row: row))
            .Where(item => item.Endereco is not null)
            .Select(item => new LinkedInEmail(item.Endereco!,
                string.Equals(Field(item.Row, "Primary"), "Yes", StringComparison.OrdinalIgnoreCase)))
            .ToList();

    private static List<LinkedInTelefone> ReadTelefones(IReadOnlyList<IReadOnlyDictionary<string, string>> rows) =>
        rows.Select(row => (Numero: Field(row, "Number"), Row: row))
            .Where(item => item.Numero is not null)
            .Select(item => new LinkedInTelefone(item.Numero!, Field(item.Row, "Type")))
            .ToList();

    // The "Websites" column looks like "[PERSONAL:https://example.test,OTHER:https://example.test/x]";
    // an item without a "TYPE:" prefix is kept as a plain address.
    private static List<LinkedInSite> ParseSites(string? websites)
    {
        var sites = new List<LinkedInSite>();
        if (websites is null) return sites;

        foreach (var item in websites.Trim('[', ']').Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var separator = item.IndexOf(':');
            var hasType = separator > 0
                && item[..separator].All(character => char.IsAsciiLetter(character) || character == '_')
                && item[(separator + 1)..].StartsWith("http", StringComparison.OrdinalIgnoreCase);
            sites.Add(hasType ? new LinkedInSite(item[..separator], item[(separator + 1)..]) : new LinkedInSite(null, item));
        }

        return sites;
    }
}
