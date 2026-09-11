using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;
using TalentValley.Api.Storage;

namespace TalentValley.Api.Tests;

public sealed class TalentDiscoveryTests
{
    private static readonly byte[] Photo = [0xff, 0xd8, 0xff, 0xe0, 7];
    private static readonly byte[] Pdf = "%PDF-1.7 recruiter"u8.ToArray();

    [Fact]
    public async Task Search_requires_an_active_recruiter_and_rechecks_blocking()
    {
        using var factory = new ApiFactory();
        var recruiterEmail = Email("recruiter");
        var recruiterId = await factory.CreateUserAsync(recruiterEmail, AppRoles.Recruiter);
        var studentEmail = Email("student");
        await factory.CreateUserAsync(studentEmail);
        var adminEmail = Email("admin");
        await factory.CreateUserAsync(adminEmail, AppRoles.Admin);

        using var anonymous = factory.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/talentos")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/talentos/unknown")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/talentos/unknown/foto")).StatusCode);
        using var student = factory.Client();
        await ApiFactory.LoginAsync(student, studentEmail);
        Assert.Equal(HttpStatusCode.Forbidden, (await student.GetAsync("/api/talentos")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await student.GetAsync("/api/talentos/unknown")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await student.GetAsync("/api/talentos/unknown/curriculo")).StatusCode);
        using var admin = factory.Client();
        await ApiFactory.LoginAsync(admin, adminEmail);
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.GetAsync("/api/talentos")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await admin.GetAsync($"/api/talentos/unknown/formacoes/{Guid.NewGuid()}/certificado")).StatusCode);
        using var recruiter = factory.Client();
        await ApiFactory.LoginAsync(recruiter, recruiterEmail);
        Assert.Equal(HttpStatusCode.OK, (await recruiter.GetAsync("/api/talentos")).StatusCode);

        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            (await db.Recrutadores.SingleAsync(x => x.UserId == recruiterId)).Status = StatusRecrutador.BLOQUEADO;
            await db.SaveChangesAsync();
        });
        Assert.Equal(HttpStatusCode.Forbidden, (await recruiter.GetAsync("/api/talentos")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await recruiter.GetAsync("/api/talentos/unknown")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await recruiter.GetAsync("/api/talentos/unknown/foto")).StatusCode);
    }

    [Fact]
    public async Task Filters_use_or_within_groups_and_and_between_groups_including_project_competencies()
    {
        using var factory = new ApiFactory();
        var recruiter = await RecruiterAsync(factory);
        using var client = recruiter.Client;
        int react = 0, csharp = 0;
        var generalId = await StudentAsync(factory, "João General", "joao-general", "Rio Pomba", "MG");
        var projectId = await StudentAsync(factory, "Ana Project", "ana-project", "Rio Pomba", "MG");
        await StudentAsync(factory, "Hidden Person", "hidden", "Rio Pomba", "MG", active: false);
        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            var skills = new[]
            {
                new Competencia { Nome = "React Test", NomeBusca = "react test" },
                new Competencia { Nome = "C# Test", NomeBusca = "c# test" }
            };
            db.Competencias.AddRange(skills);
            await db.SaveChangesAsync();
            react = skills[0].Id;
            csharp = skills[1].Id;
            db.AlunoCompetencias.Add(new() { AlunoId = generalId, CompetenciaId = react });
            var project = new Projeto
            {
                Id = Guid.NewGuid(), AlunoId = projectId, Ordem = 1, Nome = "App", Descricao = "Demo",
                DataInicio = new(2026, 1, 1), EmAndamento = true
            };
            db.Projetos.Add(project);
            db.ProjetoCompetencias.Add(new() { ProjetoId = project.Id, CompetenciaId = csharp });
            db.AlunoDisponibilidades.AddRange(
                new AlunoDisponibilidade { AlunoId = generalId, Tipo = TipoDisponibilidade.CLT },
                new AlunoDisponibilidade { AlunoId = projectId, Tipo = TipoDisponibilidade.PJ });
            await db.SaveChangesAsync();
        });

        var both = await client.GetFromJsonAsync<PaginatedResponse<TalentListItem>>(
            $"/api/talentos?competenciaIds={react}&competenciaIds={csharp}&disponibilidades=CLT&disponibilidades=PJ",
            ApiFactory.JsonOptions);
        Assert.Equal(2, both!.TotalItems);
        Assert.Equal(new[] { generalId, projectId }, both.Items.Select(x => x.Id));

        var normalized = await client.GetFromJsonAsync<PaginatedResponse<TalentListItem>>(
            "/api/talentos?nome=joao&cidade=rio%20pomba&uf=mg", ApiFactory.JsonOptions);
        Assert.Equal(generalId, Assert.Single(normalized!.Items).Id);
        Assert.DoesNotContain(normalized.Items, x => x.Slug == "hidden");
    }

    [Fact]
    public async Task Education_filters_match_one_formation_and_verified_means_verified_rpv()
    {
        using var factory = new ApiFactory();
        var recruiter = await RecruiterAsync(factory);
        using var client = recruiter.Client;
        var splitId = await StudentAsync(factory, "Split", "split");
        var matchId = await StudentAsync(factory, "Match", "match");
        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            db.Formacoes.AddRange(
                Formation(splitId, TipoFormacao.TECNICO, StatusFormacao.EM_ANDAMENTO, "Systems"),
                Formation(splitId, TipoFormacao.GRADUACAO, StatusFormacao.CONCLUIDO, "Other"),
                Formation(matchId, TipoFormacao.TECNICO, StatusFormacao.CONCLUIDO, "Sistemas Ágeis", true,
                    StatusValidacaoRpv.VERIFICADO));
            await db.SaveChangesAsync();
        });

        var response = await client.GetFromJsonAsync<PaginatedResponse<TalentListItem>>(
            "/api/talentos?tiposFormacao=TECNICO&statusFormacao=CONCLUIDO&formacaoNome=sistemas%20ageis&rpvVerificado=true",
            ApiFactory.JsonOptions);
        Assert.Equal(matchId, Assert.Single(response!.Items).Id);
        Assert.DoesNotContain(response.Items, x => x.Id == splitId);
    }

    [Fact]
    public async Task Sorting_defaults_and_pagination_are_deterministic_and_validated()
    {
        using var factory = new ApiFactory();
        var recruiter = await RecruiterAsync(factory);
        using var client = recruiter.Client;
        var ids = new List<Guid>();
        for (var i = 0; i < 12; i++)
            ids.Add(await StudentAsync(factory, $"Person {i:00}", $"person-{i:00}", updatedAt: new(2026, 1, 1, i, 0, 0, TimeSpan.Zero)));

        var recent = await client.GetFromJsonAsync<PaginatedResponse<TalentListItem>>("/api/talentos", ApiFactory.JsonOptions);
        Assert.Equal(10, recent!.PageSize);
        Assert.Equal(12, recent.TotalItems);
        Assert.Equal(2, recent.TotalPages);
        Assert.Equal(ids[^1], recent.Items.First().Id);
        var page2 = await client.GetFromJsonAsync<PaginatedResponse<TalentListItem>>("/api/talentos?page=2", ApiFactory.JsonOptions);
        Assert.Equal(2, page2!.Items.Count);
        Assert.Empty(recent.Items.Select(x => x.Id).Intersect(page2.Items.Select(x => x.Id)));

        var byName = await client.GetFromJsonAsync<PaginatedResponse<TalentListItem>>(
            "/api/talentos?ordenacao=nome", ApiFactory.JsonOptions);
        Assert.Equal("Person 00", byName!.Items.First().NomeCompleto);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/talentos?page=0")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/talentos?page=2147483647")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/talentos?uf=M1")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/talentos?ordenacao=unknown")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/talentos?modalidades=999")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/talentos?disponibilidades=999")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/talentos?competenciaIds=2147483647")).StatusCode);
    }

    [Fact]
    public async Task Relevance_and_recent_ties_use_name_then_id_deterministically()
    {
        using var factory = new ApiFactory();
        var recruiter = await RecruiterAsync(factory);
        using var client = recruiter.Client;
        var sameTime = new DateTimeOffset(2026, 2, 1, 0, 0, 0, TimeSpan.Zero);
        var first = await StudentAsync(factory, "Same Name", "tie-one", updatedAt: sameTime);
        var second = await StudentAsync(factory, "Same Name", "tie-two", updatedAt: sameTime);
        var expected = new[] { first, second }.OrderBy(x => x.ToString()).ToArray();

        var recent = await client.GetFromJsonAsync<PaginatedResponse<TalentListItem>>(
            "/api/talentos?ordenacao=recentes", ApiFactory.JsonOptions);
        Assert.Equal(expected, recent!.Items.Select(x => x.Id));
        var relevance = await client.GetFromJsonAsync<PaginatedResponse<TalentListItem>>(
            "/api/talentos?uf=MG", ApiFactory.JsonOptions);
        Assert.Equal(expected, relevance!.Items.Select(x => x.Id));
        Assert.Equal(relevance.Items.Select(x => x.Id),
            (await client.GetFromJsonAsync<PaginatedResponse<TalentListItem>>(
                "/api/talentos?uf=MG", ApiFactory.JsonOptions))!.Items.Select(x => x.Id));
    }

    [Fact]
    public async Task Detail_and_files_are_private_safe_and_immediately_hidden_when_student_is_blocked()
    {
        using var factory = new ApiFactory();
        var recruiter = await RecruiterAsync(factory);
        using var client = recruiter.Client;
        var studentId = await StudentAsync(factory, "Professional", "professional");
        var otherId = await StudentAsync(factory, "Other", "other");
        Guid formationId = default, otherFormationId = default;
        string photoKey = "", curriculumKey = "", certificateKey = "", loginEmail = "";
        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            var storage = services.GetRequiredService<IFileStorage>();
            photoKey = await storage.StoreAsync(FileCategory.Photo, new MemoryStream(Photo), ".jpg");
            curriculumKey = await storage.StoreAsync(FileCategory.Curriculum, new MemoryStream(Pdf), ".pdf");
            certificateKey = await storage.StoreAsync(FileCategory.Certificate, new MemoryStream(Pdf), ".pdf");
            var student = await db.Alunos.Include(x => x.User).SingleAsync(x => x.UserId == studentId);
            loginEmail = student.User.Email!;
            student.FotoStorageKey = photoKey;
            student.CurriculoStorageKey = curriculumKey;
            student.Telefone = "123";
            student.EmailProfissional = null;
            student.LinkedInUrl = "https://linkedin.example/p";
            formationId = Guid.NewGuid();
            otherFormationId = Guid.NewGuid();
            db.Formacoes.AddRange(
                new Formacao
                {
                    Id = formationId, AlunoId = studentId, Tipo = TipoFormacao.CURSO_LIVRE,
                    Nome = "Course", NomeBusca = "course", Instituicao = "School",
                    CertificadoStorageKey = certificateKey
                },
                new Formacao
                {
                    Id = otherFormationId, AlunoId = otherId, Tipo = TipoFormacao.CURSO_LIVRE,
                    Nome = "Other", NomeBusca = "other", Instituicao = "School",
                    CertificadoStorageKey = certificateKey
                });
            await db.SaveChangesAsync();
        });

        var detailResponse = await client.GetAsync("/api/talentos/professional");
        var json = await detailResponse.Content.ReadAsStringAsync();
        var detail = await detailResponse.Content.ReadFromJsonAsync<TalentProfileResponse>(ApiFactory.JsonOptions);
        Assert.Equal(HttpStatusCode.OK, detailResponse.StatusCode);
        Assert.Null(detail!.Contato.EmailProfissional);
        Assert.DoesNotContain(loginEmail, json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(photoKey, json);
        Assert.DoesNotContain(curriculumKey, json);
        Assert.DoesNotContain(certificateKey, json);
        Assert.Equal(Photo, await (await client.GetAsync("/api/talentos/professional/foto")).Content.ReadAsByteArrayAsync());
        var curriculum = await client.GetAsync("/api/talentos/professional/curriculo");
        Assert.Equal("application/pdf", curriculum.Content.Headers.ContentType!.MediaType);
        Assert.Contains("curriculo.pdf", curriculum.Content.Headers.ContentDisposition!.FileName!);
        Assert.Contains("no-store", curriculum.Headers.CacheControl!.ToString());
        var certificate = await client.GetAsync($"/api/talentos/professional/formacoes/{formationId}/certificado");
        Assert.Equal(Pdf, await certificate.Content.ReadAsByteArrayAsync());
        Assert.Contains("certificado.pdf", certificate.Content.Headers.ContentDisposition!.FileName!);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync($"/api/talentos/professional/formacoes/{otherFormationId}/certificado")).StatusCode);

        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            (await db.Alunos.SingleAsync(x => x.UserId == studentId)).Ativo = false;
            await db.SaveChangesAsync();
        });
        Assert.DoesNotContain((await client.GetFromJsonAsync<PaginatedResponse<TalentListItem>>(
            "/api/talentos", ApiFactory.JsonOptions))!.Items, x => x.Id == studentId);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/talentos/professional")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/talentos/professional/foto")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/talentos/professional/curriculo")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync($"/api/talentos/professional/formacoes/{formationId}/certificado")).StatusCode);
    }

    [Fact]
    public async Task Relevance_weights_general_above_project_only_without_double_counting()
    {
        using var factory = new ApiFactory();
        var recruiter = await RecruiterAsync(factory);
        using var client = recruiter.Client;
        var a = await StudentAsync(factory, "A", "a");
        var b = await StudentAsync(factory, "B", "b");
        var c = await StudentAsync(factory, "C", "c");
        var d = await StudentAsync(factory, "D", "d");
        int react = 0, csharp = 0;
        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            var skills = new[]
            {
                new Competencia { Nome = "React Rank", NomeBusca = "react rank" },
                new Competencia { Nome = "CSharp Rank", NomeBusca = "csharp rank" }
            };
            db.Competencias.AddRange(skills);
            await db.SaveChangesAsync();
            react = skills[0].Id;
            csharp = skills[1].Id;
            db.AlunoCompetencias.AddRange(
                new AlunoCompetencia { AlunoId = a, CompetenciaId = react },
                new AlunoCompetencia { AlunoId = a, CompetenciaId = csharp },
                new AlunoCompetencia { AlunoId = b, CompetenciaId = react },
                new AlunoCompetencia { AlunoId = d, CompetenciaId = react });
            AddProject(db, b, csharp);
            AddProject(db, c, react);
            AddProject(db, d, react);
            await db.SaveChangesAsync();
        });
        var result = await client.GetFromJsonAsync<PaginatedResponse<TalentListItem>>(
            $"/api/talentos?competenciaIds={react}&competenciaIds={csharp}", ApiFactory.JsonOptions);
        Assert.Equal(new[] { a, b, d, c }, result!.Items.Select(x => x.Id));
    }

    private static void AddProject(AppDbContext db, Guid studentId, int competencyId)
    {
        var project = new Projeto
        {
            Id = Guid.NewGuid(), AlunoId = studentId, Ordem = 1, Nome = "Project", Descricao = "Description",
            DataInicio = new(2026, 1, 1), EmAndamento = true
        };
        db.Projetos.Add(project);
        db.ProjetoCompetencias.Add(new() { ProjetoId = project.Id, CompetenciaId = competencyId });
    }

    private static Formacao Formation(Guid studentId, TipoFormacao type, StatusFormacao status,
        string name, bool rpv = false, StatusValidacaoRpv? validation = null) => new()
        {
            Id = Guid.NewGuid(), AlunoId = studentId, Tipo = type, Status = status, Nome = name,
            NomeBusca = TalentValley.Api.Services.NameNormalizer.Normalize(name), Instituicao = "Institute",
            DataInicio = new(2025, 1, 1), DataFim = status == StatusFormacao.CONCLUIDO ? new(2026, 1, 1) : null,
            EhRioPombaValley = rpv, StatusValidacaoRpv = validation
        };

    private static async Task<(HttpClient Client, Guid Id)> RecruiterAsync(ApiFactory factory)
    {
        var email = Email("recruiter");
        var id = await factory.CreateUserAsync(email, AppRoles.Recruiter);
        var client = factory.Client();
        Assert.Equal(HttpStatusCode.OK, (await ApiFactory.LoginAsync(client, email)).StatusCode);
        return (client, id);
    }

    private static async Task<Guid> StudentAsync(ApiFactory factory, string name, string slug,
        string? city = "Rio Pomba", string? uf = "MG", bool active = true, DateTimeOffset? updatedAt = null)
    {
        var id = await factory.CreateUserAsync(Email(slug), active: active);
        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            var user = await db.Users.SingleAsync(x => x.Id == id);
            var student = await db.Alunos.SingleAsync(x => x.UserId == id);
            user.NomeCompleto = name;
            user.NomeBusca = TalentValley.Api.Services.NameNormalizer.Normalize(name);
            student.Slug = slug;
            student.Cidade = city;
            student.Uf = uf;
            student.AtualizadoEm = updatedAt ?? new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
            await db.SaveChangesAsync();
        });
        return id;
    }

    private static string Email(string prefix) => $"{prefix}-{Guid.NewGuid():N}@example.test";
}
