using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;
using TalentValley.Api.Storage;

namespace TalentValley.Api.Tests;

// Every person and company below is fictional.
public sealed class LinkedInImportPreviewTests : IDisposable
{
    private const string Endpoint = "/api/alunos/me/importacao-linkedin/previa";

    // U+FFFE is not a character; it is built from its number so it stays visible in the source.
    private static readonly string NotACharacter = ((char)0xFFFE).ToString();

    private const string Profile =
        "First Name,Last Name,Address,Headline,Summary,Industry,Zip Code,Geo Location,Websites\n" +
        "Ana,Exemplo,,Estudante,\"Gosto de dados 🚀\",Tech,36180-000,\"Rio Pomba, Minas Gerais, Brazil\"," +
        "\"[PERSONAL:https://ana.example.test,OTHER:https://ana.example.test/blog,OTHER:https://github.com/ana-exemplo]\"\n";

    private const string Positions =
        "Company Name,Title,Description,Location,Started On,Finished On\n" +
        "Empresa Fictícia,Estagiária de TI,Suporte a usuários,\"Rio Pomba, MG\",Jan 2024,\n" +
        "Outra Empresa,Analista Jr,,,Mar 2022,Dec 2023\n" +
        "Sem Data,Analista,,,,\n" +
        "Datas Trocadas,Analista,,,Mar 2024,Jan 2023\n";

    // The bachelor's degree always ends in the future, so it is always ongoing.
    private static readonly string Education =
        "School Name,Start Date,End Date,Notes,Degree Name,Activities\n" +
        "Instituto Exemplo,2021,2024,,Técnico em Informática,\n" +
        $"Faculdade Exemplo,2023,{DateTime.UtcNow.Year + 2},,Bacharelado em Sistemas de Informação,\n" +
        "Faculdade Exemplo,2020,2021,,,\n";

    private const string Certifications =
        "Name,Url,Authority,Started On,Finished On,License Number\n" +
        "Curso de Excel,https://cert.example.test/1,Escola Fictícia,Mar 2023,,ABC-123\n" +
        "Curso Sem Data,,Escola Fictícia,,,\n" +
        "Curso Sem Emissor,,,Mar 2023,,\n";

    private const string Skills = "Name\nPython\nSQL\nHabilidade Que Nao Existe\n";

    private const string Languages = "Name,Proficiency\nInglês,PROFESSIONAL_WORKING\nEspanhol,\nKlingon,NATIVE_OR_BILINGUAL\n";

    private const string Emails = "Email Address,Confirmed,Primary,Updated On\nana@example.test,Yes,Yes,2024-01-03\n";

    private const string Phones = "Extension,Number,Type\n,+55 32 99999-0000,Mobile\n,+1 415 555 0100,Home\n";

    private const string Projects =
        "Title,Description,Url,Started On,Finished On\n" +
        "Site da turma,Site feito em grupo,https://turma.example.test,Feb 2024,Jun 2024\n" +
        "Sem Descrição,,,Feb 2024,\n";

    private readonly ApiFactory factory = new();

    public void Dispose() => factory.Dispose();

    private static byte[] FullExport() => LinkedInZipBuilder.Build(("Profile.csv", Profile), ("Positions.csv", Positions),
        ("Education.csv", Education), ("Certifications.csv", Certifications), ("Skills.csv", Skills),
        ("Languages.csv", Languages), ("Projects.csv", Projects), ("Email Addresses.csv", Emails),
        ("PhoneNumbers.csv", Phones));

    private async Task<(HttpClient Client, Guid Id)> StudentAsync(string email = "aluno@example.test")
    {
        var id = await factory.CreateUserAsync(email);
        var client = factory.Client();
        await ApiFactory.LoginAsync(client, email);
        await ApiFactory.SetCsrfAsync(client);
        return (client, id);
    }

    private static async Task<HttpResponseMessage> UploadAsync(HttpClient client, byte[] bytes, string filename = "Basic_LinkedInDataExport.zip",
        string mime = "application/zip")
    {
        using var multipart = new MultipartFormDataContent();
        var content = new ByteArrayContent(bytes);
        content.Headers.ContentType = MediaTypeHeaderValue.Parse(mime);
        multipart.Add(content, "file", filename);
        return await client.PostAsync(Endpoint, multipart);
    }

    private static async Task<ImportacaoLinkedInPreviaResponse> PreviewAsync(HttpClient client, byte[] zip)
    {
        var response = await UploadAsync(client, zip);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ImportacaoLinkedInPreviaResponse>(ApiFactory.JsonOptions))!;
    }

    [Fact]
    public async Task Anonymous_gets_401()
    {
        using var client = factory.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await UploadAsync(client, FullExport())).StatusCode);
    }

    [Theory]
    [InlineData(AppRoles.Recruiter)]
    [InlineData(AppRoles.Admin)]
    public async Task Other_roles_get_403(string role)
    {
        await factory.CreateUserAsync("person@example.test", role);
        using var client = factory.Client();
        await ApiFactory.LoginAsync(client, "person@example.test");
        await ApiFactory.SetCsrfAsync(client);

        Assert.Equal(HttpStatusCode.Forbidden, (await UploadAsync(client, FullExport())).StatusCode);
    }

    [Fact]
    public async Task Blocked_student_gets_403()
    {
        var (client, id) = await StudentAsync();
        using (client)
        {
            await factory.InScopeAsync(async provider =>
            {
                var db = provider.GetRequiredService<AppDbContext>();
                (await db.Alunos.SingleAsync(x => x.UserId == id)).Ativo = false;
                await db.SaveChangesAsync();
            });

            Assert.Equal(HttpStatusCode.Forbidden, (await UploadAsync(client, FullExport())).StatusCode);
        }
    }

    [Fact]
    public async Task Request_without_csrf_gets_400()
    {
        await factory.CreateUserAsync("aluno@example.test");
        using var client = factory.Client();
        await ApiFactory.LoginAsync(client, "aluno@example.test");
        client.DefaultRequestHeaders.Remove("X-XSRF-TOKEN");

        Assert.Equal(HttpStatusCode.BadRequest, (await UploadAsync(client, FullExport())).StatusCode);
    }

    [Theory]
    [InlineData("dados.pdf", "application/pdf")]
    [InlineData("dados.zip", "text/plain")]
    public async Task Wrong_extension_or_content_type_gets_400(string filename, string mime)
    {
        var (client, _) = await StudentAsync();
        using (client)
            Assert.Equal(HttpStatusCode.BadRequest, (await UploadAsync(client, FullExport(), filename, mime)).StatusCode);
    }

    [Fact]
    public async Task File_that_is_not_a_zip_gets_400()
    {
        var (client, _) = await StudentAsync();
        using (client)
            Assert.Equal(HttpStatusCode.BadRequest, (await UploadAsync(client, "not a zip at all"u8.ToArray())).StatusCode);
    }

    [Fact]
    public async Task Corrupted_zip_gets_400()
    {
        var (client, _) = await StudentAsync();
        using (client)
        {
            var zip = FullExport();
            var corrupted = zip[..(zip.Length / 2)];

            Assert.Equal(HttpStatusCode.BadRequest, (await UploadAsync(client, corrupted)).StatusCode);
        }
    }

    [Fact]
    public async Task Zip_without_any_expected_file_gives_an_empty_preview()
    {
        var (client, _) = await StudentAsync();
        using (client)
        {
            var preview = await PreviewAsync(client, LinkedInZipBuilder.Build(("Connections.csv", "First Name\nIgnored\n")));

            Assert.Empty(preview.Campos);
            Assert.Null(preview.Localizacao);
            Assert.Empty(preview.Experiencias);
            Assert.Empty(preview.Formacoes);
            Assert.Empty(preview.Certificacoes);
            Assert.Empty(preview.Competencias);
            Assert.Empty(preview.Idiomas);
            Assert.Empty(preview.Projetos);
            Assert.Equal(2, preview.VagasProjetos);
            Assert.Empty(preview.NaoReconhecidos);
        }
    }

    [Fact]
    public async Task Full_export_is_translated_into_new_items()
    {
        var (client, _) = await StudentAsync();
        using (client)
        {
            var preview = await PreviewAsync(client, FullExport());

            AssertFields(preview);
            Assert.Equal(new LocalizacaoImportacaoPrevia("Rio Pomba", "MG", SituacaoItemImportacao.NOVO), preview.Localizacao);
            AssertExperiences(preview);
            AssertFormations(preview);
            AssertCompetenciesAndLanguages(preview);
            AssertProjects(preview);
            Assert.Contains(preview.NaoReconhecidos, x => x.Secao == SecaoImportacao.CONTATO && x.Valor == "+1 415 555 0100");
        }
    }

    private static void AssertFields(ImportacaoLinkedInPreviaResponse preview)
    {
        var fields = preview.Campos.ToDictionary(x => x.Campo);
        Assert.Equal("Gosto de dados", fields[CampoContatoImportacao.BIO].Valor);
        Assert.Equal(["Emojis removidos do texto."], fields[CampoContatoImportacao.BIO].Avisos);
        Assert.Equal("32999990000", fields[CampoContatoImportacao.TELEFONE].Valor);
        Assert.Equal("ana@example.test", fields[CampoContatoImportacao.EMAIL_PROFISSIONAL].Valor);
        Assert.Equal("https://github.com/ana-exemplo", fields[CampoContatoImportacao.GITHUB_URL].Valor);
        Assert.Equal("https://ana.example.test", fields[CampoContatoImportacao.PORTFOLIO_URL].Valor);
        Assert.All(fields.Values, x => Assert.Equal(SituacaoItemImportacao.NOVO, x.Situacao));
    }

    private static void AssertExperiences(ImportacaoLinkedInPreviaResponse preview)
    {
        Assert.Equal(4, preview.Experiencias.Count);
        var internship = preview.Experiencias[0];
        Assert.Equal(("Empresa Fictícia", "Estagiária de TI", TipoExperiencia.ESTAGIO), (internship.Empresa, internship.Cargo, internship.Tipo));
        Assert.Equal(new DateOnly(2024, 1, 1), internship.DataInicio);
        Assert.True(internship.Atual);
        Assert.Null(internship.DataFim);
        Assert.Equal(SituacaoItemImportacao.NOVO, internship.Situacao);

        var past = preview.Experiencias[1];
        Assert.Equal(TipoExperiencia.PROFISSIONAL, past.Tipo);
        Assert.False(past.Atual);
        Assert.Equal(new DateOnly(2023, 12, 1), past.DataFim);

        Assert.Equal("Sem data de início.", preview.Experiencias[2].Motivo);
        Assert.Equal("A data de fim é anterior à data de início.", preview.Experiencias[3].Motivo);
        Assert.All(preview.Experiencias.Skip(2), x => Assert.Equal(SituacaoItemImportacao.NAO_IMPORTAVEL, x.Situacao));
    }

    private static void AssertFormations(ImportacaoLinkedInPreviaResponse preview)
    {
        Assert.Equal(3, preview.Formacoes.Count);
        var technical = preview.Formacoes[0];
        Assert.Equal((TipoFormacao.TECNICO, StatusFormacao.CONCLUIDO), (technical.Tipo, technical.Status));
        Assert.Equal(new DateOnly(2024, 1, 1), technical.DataFim);

        var bachelor = preview.Formacoes[1];
        Assert.Equal((TipoFormacao.GRADUACAO, StatusFormacao.EM_ANDAMENTO), (bachelor.Tipo, bachelor.Status));
        Assert.Null(bachelor.DataFim);

        Assert.Equal(SituacaoItemImportacao.NAO_IMPORTAVEL, preview.Formacoes[2].Situacao);
        Assert.Equal("Sem o nome do curso.", preview.Formacoes[2].Motivo);

        Assert.Equal(3, preview.Certificacoes.Count);
        var certification = preview.Certificacoes[0];
        Assert.Equal(("Curso de Excel", "Escola Fictícia", TipoFormacao.CURSO_LIVRE, StatusFormacao.CONCLUIDO),
            (certification.Nome, certification.Instituicao, certification.Tipo, certification.Status));
        Assert.Equal(new DateOnly(2023, 3, 1), certification.DataInicio);
        Assert.Equal(certification.DataInicio, certification.DataFim);
        Assert.Equal("Sem data de emissão válida.", preview.Certificacoes[1].Motivo);
        Assert.Equal("Sem o emissor da certificação.", preview.Certificacoes[2].Motivo);
    }

    private static void AssertCompetenciesAndLanguages(ImportacaoLinkedInPreviaResponse preview)
    {
        Assert.Equal(["Python", "SQL"], preview.Competencias.Select(x => x.Nome));
        Assert.All(preview.Competencias, x => Assert.Equal(SituacaoItemImportacao.NOVO, x.Situacao));
        Assert.Contains(preview.NaoReconhecidos, x => x.Secao == SecaoImportacao.COMPETENCIA && x.Valor == "Habilidade Que Nao Existe");

        var english = preview.Idiomas.Single(x => x.Nome == "Inglês");
        Assert.Equal((NivelIdioma.AVANCADO, SituacaoItemImportacao.NOVO), (english.Nivel, english.Situacao));
        var spanish = preview.Idiomas.Single(x => x.Nome == "Espanhol");
        Assert.Equal(SituacaoItemImportacao.NAO_IMPORTAVEL, spanish.Situacao);
        Assert.NotNull(spanish.Motivo);
        Assert.Contains(preview.NaoReconhecidos, x => x.Secao == SecaoImportacao.IDIOMA && x.Valor == "Klingon");
    }

    private static void AssertProjects(ImportacaoLinkedInPreviaResponse preview)
    {
        Assert.Equal(2, preview.VagasProjetos);
        var project = preview.Projetos[0];
        Assert.Equal(("Site da turma", "Site feito em grupo", false), (project.Nome, project.Descricao, project.EmAndamento));
        Assert.Equal(new DateOnly(2024, 2, 1), project.DataInicio);
        Assert.Equal(new DateOnly(2024, 6, 1), project.DataFim);
        Assert.Equal(SituacaoItemImportacao.NOVO, project.Situacao);
        Assert.Equal("Sem descrição.", preview.Projetos[1].Motivo);
    }

    [Fact]
    public async Task Items_the_student_already_has_are_marked_and_never_overwritten()
    {
        var (client, id) = await StudentAsync();
        using (client)
        {
            await SeedExistingProfileAsync(client, id);

            var preview = await PreviewAsync(client, FullExport());

            var fields = preview.Campos.ToDictionary(x => x.Campo);
            Assert.Equal(SituacaoItemImportacao.JA_EXISTE, fields[CampoContatoImportacao.BIO].Situacao);
            Assert.Equal(SituacaoItemImportacao.JA_EXISTE, fields[CampoContatoImportacao.TELEFONE].Situacao);
            Assert.Equal(SituacaoItemImportacao.NOVO, fields[CampoContatoImportacao.EMAIL_PROFISSIONAL].Situacao);
            Assert.Equal(SituacaoItemImportacao.JA_EXISTE, preview.Localizacao!.Situacao);
            Assert.Equal(SituacaoItemImportacao.JA_EXISTE, preview.Experiencias[0].Situacao);
            Assert.Equal(SituacaoItemImportacao.NOVO, preview.Experiencias[1].Situacao);
            Assert.Equal(SituacaoItemImportacao.JA_EXISTE, preview.Formacoes[0].Situacao);
            Assert.Equal(SituacaoItemImportacao.JA_EXISTE, preview.Certificacoes[0].Situacao);
            Assert.Equal(SituacaoItemImportacao.JA_EXISTE, preview.Competencias.Single(x => x.Nome == "Python").Situacao);
            Assert.Equal(SituacaoItemImportacao.NOVO, preview.Competencias.Single(x => x.Nome == "SQL").Situacao);
            Assert.Equal(SituacaoItemImportacao.JA_EXISTE, preview.Idiomas.Single(x => x.Nome == "Inglês").Situacao);
            Assert.Equal(SituacaoItemImportacao.JA_EXISTE, preview.Projetos[0].Situacao);
            Assert.Equal(1, preview.VagasProjetos);
        }
    }

    [Fact]
    public async Task Preview_does_not_change_the_profile()
    {
        var (client, _) = await StudentAsync();
        using (client)
        {
            var before = await client.GetStringAsync("/api/alunos/me");

            await PreviewAsync(client, FullExport());

            Assert.Equal(before, await client.GetStringAsync("/api/alunos/me"));
        }
    }

    [Fact]
    public async Task Behavioral_competencies_above_the_limit_are_not_importable()
    {
        var (client, _) = await StudentAsync();
        using (client)
        {
            var names = new List<string>();
            await factory.InScopeAsync(async provider =>
            {
                var db = provider.GetRequiredService<AppDbContext>();
                var all = await db.Competencias.AsNoTracking().ToListAsync();
                names.AddRange(all.Where(x => x.Categoria.Tipo() == TipoCompetencia.COMPORTAMENTAL).Take(7).Select(x => x.Nome));
            });
            Assert.Equal(7, names.Count);

            var preview = await PreviewAsync(client,
                LinkedInZipBuilder.Build(("Skills.csv", "Name\n" + string.Join('\n', names) + "\n")));

            Assert.Equal(6, preview.Competencias.Count(x => x.Situacao == SituacaoItemImportacao.NOVO));
            var blocked = Assert.Single(preview.Competencias, x => x.Situacao == SituacaoItemImportacao.NAO_IMPORTAVEL);
            Assert.Equal(names[6], blocked.Nome);
        }
    }

    [Fact]
    public async Task Project_slots_are_zero_when_the_student_has_two_projects()
    {
        var (client, _) = await StudentAsync();
        using (client)
        {
            foreach (var order in new[] { 1, 2 })
            {
                var created = await client.PostAsJsonAsync("/api/alunos/me/projetos", new
                {
                    ordem = order, nome = $"Projeto {order}", dataInicio = "2024-01-01", emAndamento = true,
                    descricao = "Descrição", competenciaIds = Array.Empty<int>()
                });
                Assert.Equal(HttpStatusCode.Created, created.StatusCode);
            }

            Assert.Equal(0, (await PreviewAsync(client, FullExport())).VagasProjetos);
        }
    }

    [Fact]
    public async Task Long_project_description_is_cut_with_a_warning()
    {
        var (client, _) = await StudentAsync();
        using (client)
        {
            var projects = $"Title,Description,Url,Started On,Finished On\nProjeto Longo,{new string('x', 1200)},,Feb 2024,\n";

            var preview = await PreviewAsync(client, LinkedInZipBuilder.Build(("Projects.csv", projects)));

            var project = Assert.Single(preview.Projetos);
            Assert.Equal(1000, project.Descricao!.Length);
            Assert.Equal(["Texto cortado em 1000 caracteres."], project.Avisos);
            Assert.True(project.EmAndamento);
            Assert.Null(project.DataFim);
        }
    }

    [Fact]
    public async Task Present_as_end_date_means_the_position_is_current()
    {
        var (client, _) = await StudentAsync();
        using (client)
        {
            var positions = "Company Name,Title,Description,Location,Started On,Finished On\nEmpresa Fictícia,Analista,,,Jan 2024,Present\n";

            var preview = await PreviewAsync(client, LinkedInZipBuilder.Build(("Positions.csv", positions)));

            var experience = Assert.Single(preview.Experiencias);
            Assert.True(experience.Atual);
            Assert.Null(experience.DataFim);
            Assert.Equal(SituacaoItemImportacao.NOVO, experience.Situacao);
        }
    }

    [Fact]
    public async Task Repeated_item_in_the_same_file_is_marked_as_existing()
    {
        var (client, _) = await StudentAsync();
        using (client)
        {
            var positions = "Company Name,Title,Description,Location,Started On,Finished On\n" +
                "Empresa Fictícia,Analista,,,Jan 2024,\nEMPRESA FICTICIA,analista,,,Jan 2024,\n";

            var preview = await PreviewAsync(client, LinkedInZipBuilder.Build(("Positions.csv", positions)));

            Assert.Equal([SituacaoItemImportacao.NOVO, SituacaoItemImportacao.JA_EXISTE],
                preview.Experiencias.Select(x => x.Situacao));
        }
    }

    [Fact]
    public async Task Location_outside_brazil_and_invalid_email_go_to_not_recognized()
    {
        var (client, _) = await StudentAsync();
        using (client)
        {
            var profile = "Summary,Geo Location,Websites\n,\"Paris, Île-de-France, France\",\"[OTHER:https://www.linkedin.com/in/ana-exemplo]\"\n";
            var emails = "Email Address,Confirmed,Primary,Updated On\nnao-e-um-email,Yes,Yes,2024-01-03\n";

            var preview = await PreviewAsync(client,
                LinkedInZipBuilder.Build(("Profile.csv", profile), ("Email Addresses.csv", emails)));

            Assert.Null(preview.Localizacao);
            Assert.Empty(preview.Campos);
            Assert.Contains(preview.NaoReconhecidos, x => x.Secao == SecaoImportacao.LOCALIZACAO);
            Assert.Contains(preview.NaoReconhecidos, x => x.Secao == SecaoImportacao.CONTATO && x.Valor == "nao-e-um-email");
        }
    }

    [Fact]
    public async Task Characters_that_are_not_text_do_not_break_the_preview()
    {
        var (client, _) = await StudentAsync();
        using (client)
        {
            var positions = "Company Name,Title,Description,Location,Started On,Finished On\nEmpresa" + NotACharacter + ",Analista,,,Jan ２０２４,\n" +
                "Empresa Fictícia,Analista,,,Jan" + NotACharacter + " 2024,\n";

            var preview = await PreviewAsync(client, LinkedInZipBuilder.Build(("Positions.csv", positions),
                ("Skills.csv", "Name\nPython" + NotACharacter + "\n"), ("Languages.csv", "Name,Proficiency\nInglês" + NotACharacter + ",FULL" + NotACharacter + "\n")));

            Assert.Equal("Data de início não reconhecida.", preview.Experiencias[0].Motivo);
            Assert.Equal(SituacaoItemImportacao.NOVO, preview.Experiencias[1].Situacao);
            Assert.Equal("Python", Assert.Single(preview.Competencias).Nome);
            Assert.Equal(NivelIdioma.FLUENTE, Assert.Single(preview.Idiomas).Nivel);
        }
    }

    [Fact]
    public async Task Response_is_not_cacheable()
    {
        var (client, _) = await StudentAsync();
        using (client)
        {
            var response = await UploadAsync(client, FullExport());

            Assert.Contains("no-store", response.Headers.CacheControl?.ToString());
        }
    }

    [Fact]
    public async Task Upload_above_the_size_limit_is_refused()
    {
        var (client, _) = await StudentAsync();
        using (client)
        {
            var tooBig = new byte[(int)FileUploadValidator.ZipMaximumBytes + 1];
            tooBig[0] = 0x50;
            tooBig[1] = 0x4b;
            tooBig[2] = 0x03;
            tooBig[3] = 0x04;

            Assert.Equal(HttpStatusCode.BadRequest, (await UploadAsync(client, tooBig)).StatusCode);
        }
    }

    private async Task SeedExistingProfileAsync(HttpClient client, Guid id)
    {
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            var aluno = await db.Alunos.SingleAsync(x => x.UserId == id);
            aluno.Bio = "Minha bio";
            aluno.Telefone = "32988887777";
            aluno.Cidade = "Ubá";
            aluno.Uf = "MG";
            aluno.Competencias.Add(new() { CompetenciaId = (await db.Competencias.SingleAsync(x => x.Nome == "Python")).Id });
            aluno.Idiomas.Add(new() { IdiomaId = (await db.Idiomas.SingleAsync(x => x.Nome == "Inglês")).Id, Nivel = NivelIdioma.BASICO });
            await db.SaveChangesAsync();
        });

        // Same company, role and month (the day may differ): it is the same experience.
        await Post(client, "/api/alunos/me/experiencias", new
        {
            empresa = "empresa fictícia", cargo = "Estagiária de TI", tipo = "ESTAGIO", dataInicio = "2024-01-15", atual = true
        });
        await Post(client, "/api/alunos/me/formacoes", new
        {
            tipo = "TECNICO", nome = "Técnico em Informática", instituicao = "Instituto Exemplo",
            dataInicio = "2021-02-10", dataFim = "2024-12-01", status = "CONCLUIDO"
        });
        await Post(client, "/api/alunos/me/formacoes", new
        {
            tipo = "CURSO_LIVRE", nome = "Curso de Excel", instituicao = "Escola Fictícia",
            dataInicio = "2023-03-20", dataFim = "2023-03-20", status = "CONCLUIDO"
        });
        await Post(client, "/api/alunos/me/projetos", new
        {
            ordem = 1, nome = "SITE DA TURMA", dataInicio = "2020-01-01", emAndamento = true,
            descricao = "Outro texto", competenciaIds = Array.Empty<int>()
        });
    }

    private static async Task Post(HttpClient client, string url, object body)
    {
        var response = await client.PostAsJsonAsync(url, body);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }
}
