using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;
using TalentValley.Api.Storage;

namespace TalentValley.Api.Services;

// A demo e-mail already belongs to an account that is not a demo account. Nothing is changed in that case.
public sealed class DemoEmailConflictException : Exception;

// Creates and removes the fictitious accounts used by the admin demonstration mode.
// It only ever touches accounts flagged EhDemo; real accounts are never read for removal or changed.
public sealed class DemoService(AppDbContext database, UserManager<ApplicationUser> users, SlugService slugs,
    AuditoriaService audit, AlunoDeletionService deletion, IOptions<DemoOptions> options)
{
    private const string EntityType = "DEMO";

    public bool Enabled => options.Value.Enabled;

    // The controller already answers 404 when off; this keeps the rule even if another caller forgets it.
    private void EnsureEnabled()
    {
        if (!Enabled) throw new InvalidOperationException("Demonstration mode is disabled.");
    }

    public async Task<DemoStateResponse> GetStateAsync()
    {
        var expected = ExpectedEmails();
        var present = await database.Users.CountAsync(x => x.EhDemo && expected.Contains(x.NormalizedEmail!));
        return new(Enabled, present == expected.Length);
    }

    // Creates only what is missing, so running it again is harmless.
    public async Task<DemoChangeResponse> PrepareAsync()
    {
        EnsureEnabled();
        DemoChangeResponse result;
        await using (var transaction = await database.Database.BeginTransactionAsync())
        {
            // Same lock as the student slug allocation: also serializes two administrators preparing at once.
            await database.Database.AcquireTransactionLockAsync(SlugService.LockKey);
            result = await CreateMissingAsync();
            await audit.RecordAsync(AcaoAuditoria.DEMO_PREPARADA, EntityType, Guid.Empty,
                $"Demonstração preparada: {result.AlunosCriados} aluno(s) e {result.RecrutadoresCriados} recrutador(es) fictício(s) criado(s).");
            await database.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        return result;
    }

    // Removes every demo account with its data and creates the original set again.
    public async Task<DemoChangeResponse> RestoreAsync()
    {
        EnsureEnabled();
        DemoChangeResponse result;
        IReadOnlyList<StoredFile> files;
        await using (var transaction = await database.Database.BeginTransactionAsync())
        {
            await database.Database.AcquireTransactionLockAsync(SlugService.LockKey);
            files = await RemoveAllAsync();
            result = await CreateMissingAsync();
            await audit.RecordAsync(AcaoAuditoria.DEMO_RESTAURADA, EntityType, Guid.Empty,
                $"Demonstração restaurada: {result.AlunosCriados} aluno(s) e {result.RecrutadoresCriados} recrutador(es) fictício(s) recriado(s).");
            await database.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        // The demo has no files of its own, but a demo student may have uploaded one while acting as that student.
        await deletion.DeleteFilesAsync(files);
        return result;
    }

    // Identity compares e-mails in upper case, so a real account written in another case still collides.
    private static string[] ExpectedEmails() =>
        [.. DemoData.Students.Select(x => NormalizeEmail(x.Email)), NormalizeEmail(DemoData.Recruiter.Email)];

    private static string NormalizeEmail(string email) => email.ToUpperInvariant();

    private async Task<DemoChangeResponse> CreateMissingAsync()
    {
        var expected = ExpectedEmails();
        var existing = await database.Users.Where(x => expected.Contains(x.NormalizedEmail!))
            .Select(x => new { x.NormalizedEmail, x.EhDemo }).ToListAsync();
        if (existing.Any(x => !x.EhDemo)) throw new DemoEmailConflictException();
        var present = existing.Select(x => x.NormalizedEmail!).ToHashSet();

        var competencias = await database.Competencias.ToDictionaryAsync(x => x.NomeBusca, x => x.Id);
        var idiomas = await database.Idiomas.ToDictionaryAsync(x => x.NomeBusca, x => x.Id);
        var now = DateTimeOffset.UtcNow;

        var students = 0;
        foreach (var student in DemoData.Students.Where(x => !present.Contains(NormalizeEmail(x.Email))))
        {
            await AddStudentAsync(student, competencias, idiomas, now);
            await database.SaveChangesAsync();
            students++;
        }

        var recruiters = 0;
        if (!present.Contains(NormalizeEmail(DemoData.Recruiter.Email)))
        {
            await AddRecruiterAsync(DemoData.Recruiter, now);
            await database.SaveChangesAsync();
            recruiters++;
        }
        return new(students, recruiters);
    }

    private async Task<ApplicationUser> CreateUserAsync(string name, string email, string role, DateTimeOffset createdAt)
    {
        // No password is set: a demo account can never sign in through the login form.
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(), UserName = email, Email = email, EmailConfirmed = true,
            NomeCompleto = name, NomeBusca = NameNormalizer.Normalize(name), CriadoEm = createdAt, EhDemo = true
        };
        AdminAccountService.RequireSuccess(await users.CreateAsync(user));
        AdminAccountService.RequireSuccess(await users.AddToRoleAsync(user, role));
        return user;
    }

    private static void ApplySearch(Aluno aluno, DemoSearch search, DateTimeOffset now)
    {
        aluno.StatusBusca = search.Status;
        aluno.StatusBuscaConfirmadoEm = now.AddDays(-search.ConfirmadoHaDias);
        aluno.ObjetivoProfissional = search.Objetivo;
        aluno.DisponivelImediatamente = search.DisponivelEmDias is null;
        aluno.DisponivelAPartirDe = search.DisponivelEmDias is { } days
            ? DateOnly.FromDateTime(now.UtcDateTime).AddDays(days) : null;
        aluno.CargaHorariaSemanal = search.CargaHoraria;
        aluno.AceitaViajar = search.AceitaViajar;
        aluno.AceitaMudarDeCidade = search.AceitaMudarDeCidade;
        aluno.PossuiVeiculoProprio = search.PossuiVeiculoProprio;
        foreach (var area in search.Areas) aluno.AreasInteresse.Add(new() { Area = area });
        foreach (var category in search.CategoriasCnh) aluno.CategoriasCnh.Add(new() { Categoria = category });
    }

    private async Task AddStudentAsync(DemoStudent data, Dictionary<string, int> competencias,
        Dictionary<string, int> idiomas, DateTimeOffset now)
    {
        var updatedAt = now.AddDays(-data.AtualizadoHaDias);
        var user = await CreateUserAsync(data.Nome, data.Email, AppRoles.Student, updatedAt);
        var aluno = new Aluno
        {
            UserId = user.Id, Slug = await slugs.GenerateAsync(data.Nome), Cidade = data.Cidade, Uf = data.Uf,
            Telefone = data.Telefone, EmailProfissional = data.Email, Bio = data.Bio, Ativo = true,
            AtualizadoEm = updatedAt
        };
        foreach (var name in data.Competencias)
            aluno.Competencias.Add(new() { CompetenciaId = CatalogId(competencias, name) });
        foreach (var language in data.Idiomas)
            aluno.Idiomas.Add(new() { IdiomaId = CatalogId(idiomas, language.Nome), Nivel = language.Nivel });
        foreach (var type in data.Disponibilidades) aluno.Disponibilidades.Add(new() { Tipo = type });
        foreach (var modality in data.Modalidades) aluno.Modalidades.Add(new() { Modalidade = modality });
        ApplySearch(aluno, data.Busca, now);

        foreach (var formation in data.Formacoes)
            aluno.Formacoes.Add(new()
            {
                Id = Guid.NewGuid(), Tipo = formation.Tipo, Nome = formation.Nome,
                NomeBusca = NameNormalizer.Normalize(formation.Nome), Instituicao = formation.Instituicao,
                DataInicio = formation.Inicio, DataFim = formation.Fim, CargaHoraria = formation.CargaHoraria,
                Status = formation.Status, Principal = formation.Principal, EhRioPombaValley = formation.RioPombaValley,
                // Validation needs a certificate, which the demo never has: it stays pending, never verified.
                StatusValidacaoRpv = formation.RioPombaValley ? StatusValidacaoRpv.PENDENTE : null,
                CriadoEm = updatedAt, AtualizadoEm = updatedAt
            });
        foreach (var experience in data.Experiencias)
            aluno.Experiencias.Add(new()
            {
                Id = Guid.NewGuid(), Empresa = experience.Empresa, Cargo = experience.Cargo, Tipo = experience.Tipo,
                DataInicio = experience.Inicio, DataFim = experience.Fim, Atual = experience.Fim is null,
                Descricao = experience.Descricao, CriadoEm = updatedAt, AtualizadoEm = updatedAt
            });
        for (var index = 0; index < data.Projetos.Length; index++)
        {
            var project = data.Projetos[index];
            var entity = new Projeto
            {
                Id = Guid.NewGuid(), Ordem = index + 1, Nome = project.Nome, DataInicio = project.Inicio,
                DataFim = project.Fim, EmAndamento = project.Fim is null, Descricao = project.Descricao,
                DemoUrl = project.DemoUrl, RepositorioUrl = project.RepositorioUrl,
                CriadoEm = updatedAt, AtualizadoEm = updatedAt
            };
            foreach (var name in project.Tecnologias)
                entity.Competencias.Add(new() { CompetenciaId = CatalogId(competencias, name) });
            aluno.Projetos.Add(entity);
        }
        database.Alunos.Add(aluno);
    }

    private async Task AddRecruiterAsync(DemoRecruiter data, DateTimeOffset now)
    {
        var user = await CreateUserAsync(data.Nome, data.Email, AppRoles.Recruiter, now);
        database.Recrutadores.Add(new Recrutador
        {
            UserId = user.Id, Empresa = data.Empresa, EmpresaBusca = NameNormalizer.Normalize(data.Empresa),
            Cargo = data.Cargo, Telefone = data.Telefone, Cidade = data.Cidade, Uf = data.Uf,
            Status = StatusRecrutador.ATIVO
        });
    }

    private static int CatalogId(Dictionary<string, int> catalog, string name) =>
        catalog.TryGetValue(NameNormalizer.Normalize(name), out var id)
            ? id
            : throw new InvalidOperationException($"Catalog entry '{name}' is missing; the catalog seed did not run.");

    // Profiles first (their owned rows and favorites cascade), then the Identity accounts (restricted FK).
    private async Task<IReadOnlyList<StoredFile>> RemoveAllAsync()
    {
        var students = await database.Alunos.Include(x => x.Formacoes).Where(x => x.User.EhDemo).ToListAsync();
        var files = new List<StoredFile>();
        foreach (var student in students)
        {
            if (student.FotoStorageKey is not null) files.Add(new(FileCategory.Photo, student.FotoStorageKey));
            if (student.CurriculoStorageKey is not null) files.Add(new(FileCategory.Curriculum, student.CurriculoStorageKey));
            files.AddRange(student.Formacoes.Where(x => x.CertificadoStorageKey is not null)
                .Select(x => new StoredFile(FileCategory.Certificate, x.CertificadoStorageKey!)));
        }
        database.Alunos.RemoveRange(students);
        database.Recrutadores.RemoveRange(await database.Recrutadores.Where(x => x.User.EhDemo).ToListAsync());
        await database.SaveChangesAsync();

        foreach (var user in await database.Users.Where(x => x.EhDemo).ToListAsync())
            AdminAccountService.RequireSuccess(await users.DeleteAsync(user));
        return files;
    }
}
