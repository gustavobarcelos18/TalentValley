using System.Text;
using TalentValley.Api.Services;
using TalentValley.Api.Storage;

namespace TalentValley.Api.Tests;

public sealed class LinkedInExportReaderTests
{
    private const string Profile =
        "First Name,Last Name,Address,Headline,Summary,Industry,Zip Code,Geo Location,Websites\n" +
        "Ana,Exemplo,,Estudante,\"Gosto de dados, de pessoas\ne de \"\"café\"\".\",Tech,36180-000,\"Rio Pomba, Minas Gerais, Brazil\",\"[PERSONAL:https://ana.example.test,OTHER:https://ana.example.test/blog]\"\n";

    private const string Positions =
        "Company Name,Title,Description,Location,Started On,Finished On\n" +
        "Empresa Fictícia,Estagiária de TI,\"Suporte a usuários,\nredes e \"\"scripts\"\"\",\"Rio Pomba, MG\",Jan 2024,\n" +
        "Outra Empresa,Analista Jr,,,Mar 2022,Dec 2023\n" +
        ",,Linha sem empresa nem cargo,,,\n";

    private const string Education =
        "School Name,Start Date,End Date,Notes,Degree Name,Activities\n" +
        "Instituto Exemplo,2021,2024,Bolsa de estudos,Técnico em Informática,Grupo de robótica\n" +
        ",2020,2021,Sem instituição,,\n";

    private const string Certifications =
        "Name,Url,Authority,Started On,Finished On,License Number\n" +
        "Curso de Excel,https://cert.example.test/1,Escola Fictícia,Mar 2023,,ABC-123\n";

    private const string Skills = "Name\nPython\nSQL\npython\n\n";

    private const string Languages = "Name,Proficiency\nInglês,PROFESSIONAL_WORKING\nEspanhol,\n";

    private const string Emails =
        "Email Address,Confirmed,Primary,Updated On\n" +
        "ana.secundario@example.test,Yes,No,2024-01-02\n" +
        "ana@example.test,Yes,Yes,2024-01-03\n" +
        ",Yes,No,\n";

    private const string Phones = "Extension,Number,Type\n,+55 32 99999-0000,Mobile\n,,Home\n";

    private const string Projects =
        "Title,Description,Url,Started On,Finished On\n" +
        "Site da turma,\"Site feito em grupo\",https://turma.example.test,Feb 2024,Jun 2024\n";

    private static LinkedInImportedData Read(byte[] zip) => new LinkedInExportReader().Read(LinkedInZipBuilder.Stream(zip));

    [Fact]
    public void Valid_export_is_read_into_every_section()
    {
        var zip = LinkedInZipBuilder.Build(("Profile.csv", Profile), ("Positions.csv", Positions),
            ("Education.csv", Education), ("Certifications.csv", Certifications), ("Skills.csv", Skills),
            ("Languages.csv", Languages), ("Projects.csv", Projects), ("Email Addresses.csv", Emails), ("PhoneNumbers.csv", Phones),
            ("Connections.csv", "First Name\nIgnored\n"));

        var data = Read(zip);

        Assert.Equal("Rio Pomba, Minas Gerais, Brazil", data.Contato.Localizacao);
        Assert.Equal(new[] { new LinkedInEmail("ana.secundario@example.test", false), new LinkedInEmail("ana@example.test", true) },
            data.Contato.Emails);
        Assert.Equal(new LinkedInTelefone("+55 32 99999-0000", "Mobile"), Assert.Single(data.Contato.Telefones));
        Assert.Equal(new[]
        {
            new LinkedInSite("PERSONAL", "https://ana.example.test"),
            new LinkedInSite("OTHER", "https://ana.example.test/blog")
        }, data.Contato.Sites);
        Assert.Equal("Gosto de dados, de pessoas\ne de \"café\".", data.Bio);

        Assert.Equal(2, data.Experiencias.Count);
        Assert.Equal(new LinkedInExperiencia("Empresa Fictícia", "Estagiária de TI", "Suporte a usuários,\nredes e \"scripts\"",
            "Rio Pomba, MG", "Jan 2024", null), data.Experiencias[0]);
        Assert.Equal("Dec 2023", data.Experiencias[1].Fim);

        var formacao = Assert.Single(data.Formacoes);
        Assert.Equal(new LinkedInFormacao("Instituto Exemplo", "Técnico em Informática", "Bolsa de estudos", "2021", "2024"), formacao);

        Assert.Equal(new LinkedInCertificacao("Curso de Excel", "Escola Fictícia", "Mar 2023", null), Assert.Single(data.Certificacoes));
        Assert.Equal(new[] { "Python", "SQL" }, data.Competencias);
        Assert.Equal(new[] { new LinkedInIdioma("Inglês", "PROFESSIONAL_WORKING"), new LinkedInIdioma("Espanhol", null) }, data.Idiomas);
        Assert.Equal(new LinkedInProjeto("Site da turma", "Site feito em grupo", "Feb 2024", "Jun 2024"), Assert.Single(data.Projetos));
    }

    [Fact]
    public void Missing_files_give_empty_sections_without_error()
    {
        var data = Read(LinkedInZipBuilder.Build(("Skills.csv", "Name\nC#\n")));

        Assert.Equal(new[] { "C#" }, data.Competencias);
        Assert.Null(data.Bio);
        Assert.Null(data.Contato.Localizacao);
        Assert.Empty(data.Contato.Sites);
        Assert.Empty(data.Contato.Emails);
        Assert.Empty(data.Contato.Telefones);
        Assert.Empty(data.Experiencias);
        Assert.Empty(data.Formacoes);
        Assert.Empty(data.Certificacoes);
        Assert.Empty(data.Idiomas);
        Assert.Empty(data.Projetos);
    }

    [Fact]
    public void Archive_without_any_expected_file_gives_an_empty_result()
    {
        var data = Read(LinkedInZipBuilder.Build(("Connections.csv", "First Name\nIgnored\n")));

        Assert.Empty(data.Competencias);
        Assert.Empty(data.Experiencias);
        Assert.Null(data.Bio);
    }

    [Fact]
    public void Missing_columns_empty_files_bom_and_header_case_are_tolerated()
    {
        var zip = LinkedInZipBuilder.Build(
            ("positions.CSV", "﻿TITLE,company name\nDev Jr,Acme\n"),
            ("Education.csv", "School Name\nEscola Fictícia\n"),
            ("Certifications.csv", ""),
            ("Languages.csv", "Name\nFrancês\n"),
            ("Email Addresses.csv", "Email Address\nana@example.test\n"),
            ("PhoneNumbers.csv", "Number\n+55 32 98888-0000\n"),
            ("Projects.csv", "Title,Description,Url,Started On,Finished On\n"));

        var data = Read(zip);

        Assert.Equal(new LinkedInExperiencia("Acme", "Dev Jr", null, null, null, null), Assert.Single(data.Experiencias));
        Assert.Equal(new LinkedInFormacao("Escola Fictícia", null, null, null, null), Assert.Single(data.Formacoes));
        Assert.Empty(data.Certificacoes);
        Assert.Equal(new LinkedInEmail("ana@example.test", false), Assert.Single(data.Contato.Emails));
        Assert.Equal(new LinkedInTelefone("+55 32 98888-0000", null), Assert.Single(data.Contato.Telefones));
        Assert.Equal(new LinkedInIdioma("Francês", null), Assert.Single(data.Idiomas));
        Assert.Empty(data.Projetos);
    }

    [Fact]
    public void Entries_that_are_not_expected_are_never_read_even_when_huge()
    {
        var huge = new byte[20 * 1024 * 1024];
        var data = Read(LinkedInZipBuilder.BuildFromBytes(("messages.csv", huge), ("Skills.csv", Encoding.UTF8.GetBytes("Name\nGit\n"))));

        Assert.Equal(new[] { "Git" }, data.Competencias);
    }

    [Fact]
    public void Zip_bomb_entry_larger_than_the_limit_is_rejected()
    {
        var bomb = new byte[LinkedInExportReader.MaxEntryBytes + 1];
        var zip = LinkedInZipBuilder.BuildFromBytes(("Skills.csv", bomb));

        Assert.Throws<UploadValidationException>(() => Read(zip));
    }

    [Fact]
    public void Zip_bomb_made_of_many_entries_that_exceed_the_total_limit_is_rejected()
    {
        var part = new byte[(int)(LinkedInExportReader.MaxEntryBytes - 1)];
        var zip = LinkedInZipBuilder.BuildFromBytes(("Profile.csv", part), ("Positions.csv", part), ("Education.csv", part),
            ("Certifications.csv", part));

        Assert.Throws<UploadValidationException>(() => Read(zip));
    }

    [Fact]
    public void Encrypted_entry_is_rejected()
    {
        var zip = LinkedInZipBuilder.Build(("Skills.csv", "Name\nGit\n"));
        MarkAsEncrypted(zip);

        Assert.Throws<UploadValidationException>(() => Read(zip));
    }

    [Fact]
    public void Archive_with_too_many_entries_is_rejected()
    {
        var entries = Enumerable.Range(0, LinkedInExportReader.MaxEntries + 1)
            .Select(index => ($"file-{index}.txt", string.Empty))
            .ToArray();
        var zip = LinkedInZipBuilder.Build(entries);

        Assert.Throws<UploadValidationException>(() => Read(zip));
    }

    [Theory]
    [InlineData("../Skills.csv")]
    [InlineData("folder/../../Skills.csv")]
    [InlineData("..\\Skills.csv")]
    [InlineData("/etc/passwd")]
    [InlineData("C:/Windows/win.ini")]
    public void Entry_with_unsafe_path_is_rejected_even_when_it_is_not_an_expected_file(string name)
    {
        var zip = LinkedInZipBuilder.Build(("Skills.csv", "Name\nGit\n"), (name, "x"));

        Assert.Throws<UploadValidationException>(() => Read(zip));
    }

    [Fact]
    public void Expected_file_inside_a_folder_is_not_read()
    {
        var data = Read(LinkedInZipBuilder.Build(("export/Skills.csv", "Name\nGit\n")));

        Assert.Empty(data.Competencias);
    }

    [Fact]
    public void Repeated_expected_entry_is_rejected()
    {
        var zip = LinkedInZipBuilder.Build(("Skills.csv", "Name\nGit\n"), ("skills.csv", "Name\nSQL\n"));

        Assert.Throws<UploadValidationException>(() => Read(zip));
    }

    [Theory]
    [InlineData("not a zip at all")]
    [InlineData("PK\u0003\u0004 truncated")]
    public void Bytes_that_are_not_a_zip_are_rejected(string content)
    {
        var bytes = Encoding.Latin1.GetBytes(content);

        Assert.Throws<UploadValidationException>(() => Read(bytes));
    }

    // Turns on the "encrypted" flag in the local and central headers of every entry.
    private static void MarkAsEncrypted(byte[] zip)
    {
        for (var index = 0; index <= zip.Length - 4; index++)
        {
            var offset = zip.AsSpan(index, 4) switch
            {
                [0x50, 0x4b, 0x03, 0x04] => 6,
                [0x50, 0x4b, 0x01, 0x02] => 8,
                _ => 0
            };
            if (offset > 0) zip[index + offset] |= 0x01;
        }
    }
}
