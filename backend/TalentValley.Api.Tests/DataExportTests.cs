using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Tests;

public sealed class DataExportTests : IDisposable
{
    private const string StudentEmail = "aluno@example.test";
    private const string OtherStudentEmail = "outro.aluno@example.test";
    private const string RecruiterEmail = "recrutador@example.test";
    private const string OtherRecruiterEmail = "outro.recrutador@example.test";
    private const string StudentExportUrl = "/api/alunos/me/exportacao";
    private const string RecruiterExportUrl = "/api/recrutador/me/exportacao";
    private const string OwnProject = "Projeto Alfa";
    private const string OtherProject = "Projeto Secreto Do Outro";
    private const string TermsVersion = "v-teste";
    private const int FirstSeededCatalogId = 20000;
    private static int seedCounter;
    private readonly ApiFactory factory = new();

    private async Task<HttpClient> LoggedInAsync(string email)
    {
        var client = factory.Client();
        Assert.Equal(HttpStatusCode.OK, (await ApiFactory.LoginAsync(client, email)).StatusCode);
        return client;
    }

    [Theory]
    [InlineData(StudentExportUrl)]
    [InlineData(RecruiterExportUrl)]
    public async Task Anonymous_export_returns_401(string url)
    {
        using var client = factory.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(url)).StatusCode);
    }

    [Theory]
    [InlineData(AppRoles.Recruiter, StudentExportUrl)]
    [InlineData(AppRoles.Admin, StudentExportUrl)]
    [InlineData(AppRoles.Student, RecruiterExportUrl)]
    [InlineData(AppRoles.Admin, RecruiterExportUrl)]
    public async Task Export_of_another_role_returns_403(string role, string url)
    {
        await factory.CreateUserAsync("person@example.test", role);
        using var client = await LoggedInAsync("person@example.test");
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync(url)).StatusCode);
    }

    [Fact]
    public async Task Recruiter_blocked_after_login_and_student_deactivated_after_login_cannot_export()
    {
        var recruiterId = await factory.CreateUserAsync(RecruiterEmail, AppRoles.Recruiter);
        var studentId = await factory.CreateUserAsync(StudentEmail);
        using var recruiter = await LoggedInAsync(RecruiterEmail);
        using var student = await LoggedInAsync(StudentEmail);
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            (await db.Recrutadores.SingleAsync(x => x.UserId == recruiterId)).Status = StatusRecrutador.BLOQUEADO;
            (await db.Alunos.SingleAsync(x => x.UserId == studentId)).Ativo = false;
            await db.SaveChangesAsync();
        });

        Assert.Equal(HttpStatusCode.Forbidden, (await recruiter.GetAsync(RecruiterExportUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await student.GetAsync(StudentExportUrl)).StatusCode);
    }

    [Fact]
    public async Task Student_exports_own_complete_data_with_consents_and_files_as_presence_only()
    {
        var id = await SeedFullStudentAsync(StudentEmail, OwnProject);
        await SeedFullStudentAsync(OtherStudentEmail, OtherProject);
        using var client = await LoggedInAsync(StudentEmail);

        var response = await client.GetAsync(StudentExportUrl);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        var export = (await response.Content.ReadFromJsonAsync<ExportacaoAlunoResponse>(ApiFactory.JsonOptions))!;
        Assert.Equal(StudentEmail, export.Conta.Email);
        Assert.Equal("Maria Álvares", export.DadosBasicos.NomeCompleto);
        Assert.Equal("Rio Pomba", export.DadosBasicos.Cidade);
        Assert.Equal("Sobre mim", export.Sobre.Bio);
        Assert.Equal("(32) 99999-0000", export.Contato.Telefone);
        Assert.Equal(TermsVersion, export.Consentimentos.VersaoTermos);
        Assert.NotNull(export.Consentimentos.ConsentimentoEm);
        Assert.True(export.Consentimentos.NewsletterAceita);
        Assert.NotNull(export.Consentimentos.NewsletterAtualizadaEm);
        Assert.Equal(new ExportacaoArquivo(true, "jpg"), export.Foto);
        Assert.Equal(new ExportacaoArquivo(true, "pdf"), export.Curriculo);
        Assert.StartsWith("Competencia Export", Assert.Single(export.Competencias).Nome);
        Assert.StartsWith("Inglês Export", Assert.Single(export.Idiomas).Nome);
        Assert.Equal(TipoDisponibilidade.ESTAGIO, Assert.Single(export.Disponibilidades));
        Assert.Equal(ModalidadeTrabalho.REMOTO, Assert.Single(export.Modalidades));
        Assert.Equal(StatusBusca.ABERTO_A_PROPOSTAS, export.Busca.Status);
        Assert.Equal("Objetivo Export", export.Busca.Objetivo);
        Assert.Equal(AreaInteresse.Redes, Assert.Single(export.Busca.AreasInteresse));
        Assert.Equal(CategoriaCnh.B, Assert.Single(export.Busca.CategoriasCnh));
        Assert.True(export.Busca.Pcd.SouPcd);
        Assert.Equal(TipoDeficiencia.VISUAL, Assert.Single(export.Busca.Pcd.Tipos));
        Assert.NotNull(export.Busca.Pcd.ConsentimentoEm);
        Assert.True(Assert.Single(export.Formacoes).PossuiCertificado);
        Assert.Equal("Empresa Export", Assert.Single(export.Experiencias).Empresa);
        Assert.Equal(OwnProject, Assert.Single(export.Projetos).Nome);
        Assert.Equal(id.ToString(), export.Slug);

        Assert.DoesNotContain(OtherProject, body);
        Assert.DoesNotContain(OtherStudentEmail, body);
        // Internal storage names and password data are never exported.
        Assert.DoesNotContain("storage", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", body);
        Assert.DoesNotContain("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", body);
        Assert.DoesNotContain("cccccccccccccccccccccccccccccccc", body);
        Assert.DoesNotContain("PasswordHash", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Student_without_files_exports_files_as_absent()
    {
        // Never accepted any terms: the export is one of the endpoints that stays available in that state.
        await factory.CreateUserAsync(StudentEmail, termsVersion: null);
        using var client = await LoggedInAsync(StudentEmail);

        var export = (await client.GetFromJsonAsync<ExportacaoAlunoResponse>(
            StudentExportUrl, ApiFactory.JsonOptions))!;

        Assert.Equal(new ExportacaoArquivo(false, null), export.Foto);
        Assert.Equal(new ExportacaoArquivo(false, null), export.Curriculo);
        Assert.Null(export.Consentimentos.ConsentimentoEm);
        Assert.False(export.Consentimentos.NewsletterAceita);
        Assert.Empty(export.Projetos);
    }

    [Fact]
    public async Task Student_ignores_a_user_id_in_the_query_and_only_gets_own_data()
    {
        var otherId = await SeedFullStudentAsync(OtherStudentEmail, OtherProject);
        await factory.CreateUserAsync(StudentEmail);
        using var client = await LoggedInAsync(StudentEmail);

        var response = await client.GetAsync($"{StudentExportUrl}?userId={otherId}&alunoId={otherId}");

        var body = await response.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains(StudentEmail, body);
        Assert.DoesNotContain(OtherStudentEmail, body);
        Assert.DoesNotContain(OtherProject, body);
    }

    [Fact]
    public async Task Recruiter_ignores_a_user_id_in_the_query_and_only_gets_own_data()
    {
        await factory.CreateUserAsync(RecruiterEmail, AppRoles.Recruiter);
        var otherId = await factory.CreateUserAsync(OtherRecruiterEmail, AppRoles.Recruiter);
        using var client = await LoggedInAsync(RecruiterEmail);

        var response = await client.GetAsync($"{RecruiterExportUrl}?userId={otherId}&recrutadorId={otherId}");

        var body = await response.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains(RecruiterEmail, body);
        Assert.DoesNotContain(OtherRecruiterEmail, body);
    }

    [Fact]
    public async Task Recruiter_exports_own_data_with_favorites_as_count_and_dates_only()
    {
        var studentId = await SeedFullStudentAsync(StudentEmail, OwnProject);
        var id = await factory.CreateUserAsync(RecruiterEmail, AppRoles.Recruiter);
        var otherId = await factory.CreateUserAsync(OtherRecruiterEmail, AppRoles.Recruiter);
        var favoritedAt = new DateTimeOffset(2026, 3, 4, 5, 6, 7, TimeSpan.Zero);
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            var recruiter = await db.Recrutadores.SingleAsync(x => x.UserId == id);
            recruiter.Empresa = "Empresa Recrutadora";
            recruiter.Cargo = "Tech Recruiter";
            recruiter.Telefone = "(32) 98888-0000";
            recruiter.Cidade = "Ubá";
            recruiter.Uf = "MG";
            recruiter.ConsentimentoEm = new DateTimeOffset(2026, 1, 2, 3, 4, 5, TimeSpan.Zero);
            recruiter.VersaoTermos = TermsVersion;
            recruiter.NewsletterAceita = true;
            recruiter.NewsletterAtualizadaEm = recruiter.ConsentimentoEm;
            var other = await db.Recrutadores.SingleAsync(x => x.UserId == otherId);
            other.Empresa = "Empresa Do Outro Recrutador";
            db.Favoritos.Add(new Favorito { RecrutadorId = id, AlunoId = studentId, CriadoEm = favoritedAt });
            db.Favoritos.Add(new Favorito { RecrutadorId = otherId, AlunoId = studentId, CriadoEm = favoritedAt.AddDays(1) });
            await db.SaveChangesAsync();
        });
        using var client = await LoggedInAsync(RecruiterEmail);

        var response = await client.GetAsync(RecruiterExportUrl);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        var export = (await response.Content.ReadFromJsonAsync<ExportacaoRecrutadorResponse>(ApiFactory.JsonOptions))!;
        Assert.Equal(RecruiterEmail, export.Conta.Email);
        Assert.Equal("Maria Álvares", export.NomeCompleto);
        Assert.Equal("Empresa Recrutadora", export.Empresa);
        Assert.Equal("Tech Recruiter", export.Cargo);
        Assert.Equal("(32) 98888-0000", export.Telefone);
        Assert.Equal("Ubá", export.Cidade);
        Assert.Equal("MG", export.Uf);
        Assert.Equal(StatusRecrutador.ATIVO, export.Status);
        Assert.Equal(TermsVersion, export.Consentimentos.VersaoTermos);
        Assert.True(export.Consentimentos.NewsletterAceita);
        Assert.Equal(1, export.Favoritos.Total);
        Assert.Equal(favoritedAt, Assert.Single(export.Favoritos.FavoritadosEm));

        // No student data and nothing from another recruiter.
        Assert.DoesNotContain(StudentEmail, body);
        Assert.DoesNotContain(OwnProject, body);
        Assert.DoesNotContain(studentId.ToString(), body);
        Assert.DoesNotContain("Empresa Do Outro Recrutador", body);
        Assert.DoesNotContain(OtherRecruiterEmail, body);
    }

    private async Task<Guid> SeedFullStudentAsync(string email, string projectName)
    {
        var id = await factory.CreateUserAsync(email);
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            var now = DateTimeOffset.UtcNow;
            var competencyId = FirstSeededCatalogId + Interlocked.Increment(ref seedCounter);
            var languageId = competencyId;
            db.Competencias.Add(new Competencia { Id = competencyId, Nome = $"Competencia Export {competencyId}", NomeBusca = $"competencia export {competencyId}" });
            db.Idiomas.Add(new Idioma { Id = languageId, Nome = $"Inglês Export {languageId}", NomeBusca = $"ingles export {languageId}" });
            await db.SaveChangesAsync();

            var aluno = await db.Alunos.SingleAsync(x => x.UserId == id);
            aluno.Cidade = "Rio Pomba";
            aluno.Uf = "MG";
            aluno.Bio = "Sobre mim";
            aluno.Telefone = "(32) 99999-0000";
            aluno.FotoStorageKey = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg";
            aluno.CurriculoStorageKey = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.pdf";
            aluno.ConsentimentoEm = now;
            aluno.VersaoTermos = TermsVersion;
            aluno.NewsletterAceita = true;
            aluno.NewsletterAtualizadaEm = now;
            db.AlunoCompetencias.Add(new AlunoCompetencia { AlunoId = id, CompetenciaId = competencyId });
            db.AlunoIdiomas.Add(new AlunoIdioma { AlunoId = id, IdiomaId = languageId, Nivel = NivelIdioma.AVANCADO });
            db.AlunoDisponibilidades.Add(new AlunoDisponibilidade { AlunoId = id, Tipo = TipoDisponibilidade.ESTAGIO });
            db.AlunoModalidades.Add(new AlunoModalidade { AlunoId = id, Modalidade = ModalidadeTrabalho.REMOTO });
            aluno.StatusBusca = StatusBusca.ABERTO_A_PROPOSTAS;
            aluno.StatusBuscaConfirmadoEm = now;
            aluno.ObjetivoProfissional = "Objetivo Export";
            aluno.SouPcd = true;
            aluno.ConsentimentoPcdEm = now;
            db.AlunoAreasInteresse.Add(new AlunoAreaInteresse { AlunoId = id, Area = AreaInteresse.Redes });
            db.AlunoCategoriasCnh.Add(new AlunoCategoriaCnh { AlunoId = id, Categoria = CategoriaCnh.B });
            db.AlunoTiposDeficiencia.Add(new AlunoTipoDeficiencia { AlunoId = id, Tipo = TipoDeficiencia.VISUAL });
            db.Formacoes.Add(new Formacao
            {
                Id = Guid.NewGuid(), AlunoId = id, Tipo = TipoFormacao.TECNICO, Nome = "Curso Export",
                NomeBusca = "curso export", Instituicao = "Instituto", DataInicio = new(2024, 1, 1),
                Status = StatusFormacao.EM_ANDAMENTO, CertificadoStorageKey = "cccccccccccccccccccccccccccccccc.pdf",
                CriadoEm = now, AtualizadoEm = now
            });
            db.Experiencias.Add(new Experiencia
            {
                Id = Guid.NewGuid(), AlunoId = id, Empresa = "Empresa Export", Cargo = "Estagiário",
                Tipo = TipoExperiencia.ESTAGIO, DataInicio = new(2025, 1, 1), Atual = true, CriadoEm = now, AtualizadoEm = now
            });
            db.Projetos.Add(new Projeto
            {
                Id = Guid.NewGuid(), AlunoId = id, Ordem = 1, Nome = projectName, DataInicio = new(2025, 1, 1),
                EmAndamento = true, Descricao = "Descrição", CriadoEm = now, AtualizadoEm = now
            });
            await db.SaveChangesAsync();
        });
        return id;
    }

    public void Dispose() => factory.Dispose();
}
