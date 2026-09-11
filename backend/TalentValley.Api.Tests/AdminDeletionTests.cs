using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;

namespace TalentValley.Api.Tests;

public sealed class AdminDeletionTests : IDisposable
{
    private readonly ApiFactory factory = new();

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Deletion_cascades_owned_data_preserves_audit_and_rolls_back_if_Identity_delete_fails(bool failIdentity)
    {
        var adminId = await factory.CreateUserAsync("admin@example.test", AppRoles.Admin);
        var id = await factory.CreateUserAsync("student@example.test");
        var recruiterId = await factory.CreateUserAsync("recruiter@example.test", AppRoles.Recruiter);
        using var admin = factory.Client();
        await ApiFactory.LoginAsync(admin, "admin@example.test");
        await ApiFactory.SetCsrfAsync(admin);
        using var student = factory.Client();
        await ApiFactory.LoginAsync(student, "student@example.test");

        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            var aluno = await db.Alunos.SingleAsync(x => x.UserId == id);
            var competence = new Competencia { Nome = "C#", NomeBusca = "c#" };
            var language = new Idioma { Nome = "Português", NomeBusca = "portugues" };
            aluno.Competencias.Add(new AlunoCompetencia { Competencia = competence });
            aluno.Idiomas.Add(new AlunoIdioma { Idioma = language, Nivel = NivelIdioma.NATIVO });
            aluno.Disponibilidades.Add(new AlunoDisponibilidade { Tipo = TipoDisponibilidade.CLT });
            aluno.Modalidades.Add(new AlunoModalidade { Modalidade = ModalidadeTrabalho.REMOTO });
            aluno.Formacoes.Add(new Formacao { Id = Guid.NewGuid(), Nome = "Curso", NomeBusca = "curso", Instituicao = "RPV" });
            aluno.Experiencias.Add(new Experiencia { Id = Guid.NewGuid(), Empresa = "Empresa", Cargo = "Analista" });
            aluno.Projetos.Add(new Projeto
            {
                Id = Guid.NewGuid(), Ordem = 1, Nome = "Projeto", Descricao = "Descrição",
                Competencias = [new ProjetoCompetencia { Competencia = competence }]
            });
            db.AddRange(aluno.Formacoes);
            db.AddRange(aluno.Experiencias);
            db.AddRange(aluno.Projetos);
            db.Favoritos.Add(new Favorito { AlunoId = id, RecrutadorId = recruiterId, CriadoEm = DateTimeOffset.UtcNow });
            db.Auditorias.Add(new Auditoria
            {
                Id = Guid.NewGuid(), AdminUserId = adminId, AdminEmailSnapshot = "admin@example.test",
                Acao = AcaoAuditoria.ALUNO_CRIADO, EntidadeTipo = AppRoles.Student, EntidadeId = id.ToString(),
                Descricao = "Acesso do aluno Maria Álvares criado.", CriadoEm = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync();
            if (failIdentity)
                await db.Database.ExecuteSqlRawAsync("CREATE TRIGGER fail_delete BEFORE DELETE ON AspNetUsers BEGIN SELECT RAISE(ABORT, 'test failure'); END;");
        });

        Assert.Equal(failIdentity ? HttpStatusCode.InternalServerError : HttpStatusCode.NoContent,
            (await admin.DeleteAsync($"/api/admin/alunos/{id}")).StatusCode);
        Assert.Equal(failIdentity ? HttpStatusCode.OK : HttpStatusCode.Forbidden,
            (await student.GetAsync("/api/auth/me")).StatusCode);
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            Assert.Equal(failIdentity, await db.Users.AnyAsync(x => x.Id == id));
            Assert.Equal(failIdentity, await db.UserRoles.AnyAsync(x => x.UserId == id));
            Assert.Equal(failIdentity, await db.Alunos.AnyAsync(x => x.UserId == id));
            Assert.Equal(failIdentity, await db.Favoritos.AnyAsync());
            Assert.Equal(failIdentity, await db.Formacoes.AnyAsync());
            Assert.Equal(failIdentity, await db.Experiencias.AnyAsync());
            Assert.Equal(failIdentity, await db.Projetos.AnyAsync());
            Assert.Equal(failIdentity, await db.ProjetoCompetencias.AnyAsync());
            Assert.Equal(failIdentity, await db.AlunoCompetencias.AnyAsync());
            Assert.Equal(failIdentity, await db.AlunoIdiomas.AnyAsync());
            Assert.Equal(failIdentity, await db.AlunoDisponibilidades.AnyAsync());
            Assert.Equal(failIdentity, await db.AlunoModalidades.AnyAsync());
            Assert.Single(await db.Competencias.ToListAsync());
            Assert.Single(await db.Idiomas.ToListAsync());
            Assert.True(await db.Users.AnyAsync(x => x.Id == recruiterId));
            var audit = await db.Auditorias.OrderBy(x => x.CriadoEm).ToListAsync();
            Assert.Equal(failIdentity ? 1 : 2, audit.Count);
            Assert.All(audit, entry => Assert.Equal(id.ToString(), entry.EntidadeId));
            if (!failIdentity)
            {
                Assert.Equal(AcaoAuditoria.ALUNO_EXCLUIDO, audit[1].Acao);
                Assert.Equal("Aluno Maria Álvares excluído.", audit[1].Descricao);
            }
        });
        if (!failIdentity)
            Assert.Equal(HttpStatusCode.NotFound, (await admin.DeleteAsync($"/api/admin/alunos/{id}")).StatusCode);
    }

    [Theory]
    [InlineData(AppRoles.Student, "alunos")]
    [InlineData(AppRoles.Recruiter, "recrutadores")]
    public async Task Failed_audit_rolls_back_state_transition(string role, string resource)
    {
        await factory.CreateUserAsync("admin@example.test", AppRoles.Admin);
        var id = await factory.CreateUserAsync("person@example.test", role);
        using var client = factory.Client();
        await ApiFactory.LoginAsync(client, "admin@example.test");
        await ApiFactory.SetCsrfAsync(client);
        await factory.InScopeAsync(async provider => await provider.GetRequiredService<AppDbContext>().Database
            .ExecuteSqlRawAsync("CREATE TRIGGER fail_audit BEFORE INSERT ON Auditorias BEGIN SELECT RAISE(ABORT, 'test failure'); END;"));
        Assert.Equal(HttpStatusCode.InternalServerError, (await client.PostAsync($"/api/admin/{resource}/{id}/bloquear", null)).StatusCode);
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            if (role == AppRoles.Student) Assert.True((await db.Alunos.SingleAsync()).Ativo);
            else Assert.Equal(StatusRecrutador.ATIVO, (await db.Recrutadores.SingleAsync()).Status);
            Assert.Empty(await db.Auditorias.ToListAsync());
        });
    }

    public void Dispose() => factory.Dispose();
}
