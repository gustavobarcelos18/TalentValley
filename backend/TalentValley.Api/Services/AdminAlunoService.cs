using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;
using TalentValley.Api.Storage;

namespace TalentValley.Api.Services;

public sealed class AdminAlunoService(AppDbContext database, AdminAccountService accounts,
    UserManager<ApplicationUser> users, SlugService slugs, AuditoriaService audit,
    IFileStorage storage, ILogger<AdminAlunoService> logger)
{
    public async Task<AdminAlunoDetailResponse?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var aluno = await FullQuery().SingleOrDefaultAsync(x => x.UserId == id, cancellationToken);
        return aluno is null ? null : MapDetail(aluno);
    }

    public Task<ProtectedFile?> OpenPhotoAsync(Guid id, CancellationToken cancellationToken) =>
        OpenFileAsync(database.Alunos.AsNoTracking().Where(x => x.UserId == id).Select(x => x.FotoStorageKey), FileCategory.Photo, null, cancellationToken);

    public Task<ProtectedFile?> OpenCurriculumAsync(Guid id, CancellationToken cancellationToken) =>
        OpenFileAsync(database.Alunos.AsNoTracking().Where(x => x.UserId == id).Select(x => x.CurriculoStorageKey), FileCategory.Curriculum, "application/pdf", cancellationToken);

    public Task<ProtectedFile?> OpenCertificateAsync(Guid alunoId, Guid formacaoId, CancellationToken cancellationToken) =>
        OpenFileAsync(database.Formacoes.AsNoTracking().Where(x => x.AlunoId == alunoId && x.Id == formacaoId)
            .Select(x => x.CertificadoStorageKey), FileCategory.Certificate, "application/pdf", cancellationToken);
    public async Task<AlunoCreatedResponse> CreateAsync(CreateAlunoRequest request)
    {
        await accounts.EnsureEmailAvailableAsync(request.Email);
        ApplicationUser user;
        // SQLite's non-deferred write transaction serializes slug allocation and account writes.
        await using (var transaction = await database.Database.BeginTransactionAsync())
        {
            user = await accounts.CreateAsync(request.NomeCompleto, request.Email, AppRoles.Student);
            database.Alunos.Add(new Aluno
            {
                UserId = user.Id, Slug = await slugs.GenerateAsync(user.NomeCompleto),
                Ativo = true, AtualizadoEm = DateTimeOffset.UtcNow
            });
            await audit.RecordAsync(AcaoAuditoria.ALUNO_CRIADO, AppRoles.Student, user.Id,
                $"Acesso do aluno {user.NomeCompleto} criado.");
            await database.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        await accounts.TrySendActivationAsync(user);
        return new(user.Id, user.NomeCompleto, user.Email!, true);
    }

    public async Task<PaginatedResponse<AlunoListItem>> ListAsync(AdminListQuery request)
    {
        var query = database.Alunos.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = NameNormalizer.Normalize(request.Search);
            query = query.Where(x => x.User.NomeBusca.Contains(search));
        }
        var total = await query.CountAsync();
        var items = await query.OrderBy(x => x.User.NomeBusca).ThenBy(x => x.UserId)
            .Skip((request.Page - 1) * 10).Take(10)
            .Select(x => new AlunoListItem(x.UserId, x.Slug, x.User.NomeCompleto,
                x.FotoStorageKey == null ? null : "/api/admin/alunos/" + x.UserId + "/foto",
                x.Cidade, x.Uf, x.Ativo, x.AtualizadoEm)).ToListAsync();
        return new(items, request.Page, 10, total, (int)Math.Ceiling(total / 10d));
    }

    public async Task<bool> SetActiveAsync(Guid id, bool active)
    {
        await using var transaction = await database.Database.BeginTransactionAsync();
        var aluno = await database.Alunos.Include(x => x.User).SingleOrDefaultAsync(x => x.UserId == id);
        if (aluno is null) return false;
        if (aluno.Ativo == active) return true;
        aluno.Ativo = active;
        aluno.User.ExclusaoAgendadaEm = active ? null : DateTimeOffset.UtcNow.AddDays(30);
        await audit.RecordAsync(active ? AcaoAuditoria.ALUNO_REATIVADO : AcaoAuditoria.ALUNO_BLOQUEADO,
            AppRoles.Student, id, $"Aluno {aluno.User.NomeCompleto} {(active ? "reativado" : "bloqueado")}.");
        await database.SaveChangesAsync();
        await transaction.CommitAsync();
        return true;
    }

    public async Task<bool> DeleteAsync(Guid id, bool recordAudit = true)
    {
        await using var transaction = await database.Database.BeginTransactionAsync();
        var aluno = await database.Alunos.Include(x => x.User).Include(x => x.Formacoes)
            .SingleOrDefaultAsync(x => x.UserId == id);
        if (aluno is null) return false;
        var user = aluno.User;
        var files = new List<(FileCategory Category, string Key)>();
        if (aluno.FotoStorageKey is not null) files.Add((FileCategory.Photo, aluno.FotoStorageKey));
        if (aluno.CurriculoStorageKey is not null) files.Add((FileCategory.Curriculum, aluno.CurriculoStorageKey));
        files.AddRange(aluno.Formacoes.Where(x => x.CertificadoStorageKey is not null)
            .Select(x => (FileCategory.Certificate, x.CertificadoStorageKey!)));
        if (recordAudit)
            await audit.RecordAsync(AcaoAuditoria.ALUNO_EXCLUIDO, AppRoles.Student, id,
                $"Aluno {user.NomeCompleto} excluído.");
        // Remove the profile first: owned rows/favorites cascade, while its Identity FK is Restrict.
        database.Alunos.Remove(aluno);
        await database.SaveChangesAsync();
        AdminAccountService.RequireSuccess(await users.DeleteAsync(user));
        await transaction.CommitAsync();
        foreach (var file in files)
        {
            try { await storage.DeleteAsync(file.Category, file.Key); }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to clean {Category} file {StorageKey} after student deletion.",
                    file.Category, file.Key);
            }
        }
        return true;
    }

    public async Task DeleteExpiredAsync(DateTimeOffset now, CancellationToken cancellationToken)
    {
        var ids = await database.Alunos.AsNoTracking().Where(x => x.User.ExclusaoAgendadaEm <= now)
            .Select(x => x.UserId).ToListAsync(cancellationToken);
        foreach (var id in ids) await DeleteAsync(id, recordAudit: false);
    }

    private IQueryable<Aluno> FullQuery() => database.Alunos.AsNoTracking().AsSplitQuery()
        .Include(x => x.User)
        .Include(x => x.Competencias).ThenInclude(x => x.Competencia)
        .Include(x => x.Idiomas).ThenInclude(x => x.Idioma)
        .Include(x => x.Disponibilidades)
        .Include(x => x.Modalidades)
        .Include(x => x.Formacoes)
        .Include(x => x.Experiencias)
        .Include(x => x.Projetos).ThenInclude(x => x.Competencias).ThenInclude(x => x.Competencia);

    private async Task<ProtectedFile?> OpenFileAsync(IQueryable<string?> keyQuery, FileCategory category,
        string? contentType, CancellationToken cancellationToken)
    {
        var key = await keyQuery.SingleOrDefaultAsync(cancellationToken);
        if (key is null) return null;
        var content = await storage.OpenReadAsync(category, key, cancellationToken);
        if (content is null) return null;
        return new ProtectedFile(content, contentType ?? PhotoContentType(key));
    }

    private static string PhotoContentType(string key) => Path.GetExtension(key).ToLowerInvariant() switch
    {
        ".png" => "image/png", ".webp" => "image/webp", _ => "image/jpeg"
    };

    private static AdminAlunoDetailResponse MapDetail(Aluno x) => new(
        x.UserId, x.Slug, x.User.NomeCompleto, x.Ativo,
        x.FotoStorageKey is null ? null : $"/api/admin/alunos/{x.UserId}/foto", x.Cidade, x.Uf,
        new(x.Telefone, x.EmailProfissional, x.LinkedInUrl, x.GitHubUrl, x.PortfolioUrl), x.Bio,
        x.Competencias.OrderBy(c => c.Competencia.NomeBusca).ThenBy(c => c.CompetenciaId)
            .Select(c => new CompetenciaResponse(c.CompetenciaId, c.Competencia.Nome)).ToList(),
        x.Idiomas.OrderBy(i => i.Idioma.NomeBusca).ThenBy(i => i.IdiomaId)
            .Select(i => new AlunoIdiomaResponse(i.IdiomaId, i.Idioma.Nome, i.Nivel)).ToList(),
        x.Disponibilidades.OrderBy(d => d.Tipo).Select(d => d.Tipo).ToList(),
        x.Modalidades.OrderBy(m => m.Modalidade).Select(m => m.Modalidade).ToList(),
        x.Formacoes.OrderByDescending(f => f.Principal).ThenByDescending(f => f.DataInicio).ThenBy(f => f.Id)
            .Select(f => new AdminFormacaoResponse(f.Id, f.Tipo, f.Nome, f.Instituicao, f.DataInicio, f.DataFim,
                f.CargaHoraria, f.Status, f.Principal, f.EhRioPombaValley, f.StatusValidacaoRpv,
                f.CertificadoStorageKey is not null, f.CertificadoStorageKey is null ? null :
                $"/api/admin/alunos/{x.UserId}/formacoes/{f.Id}/certificado", f.CriadoEm, f.AtualizadoEm)).ToList(),
        x.Experiencias.OrderByDescending(e => e.Atual).ThenByDescending(e => e.DataInicio).ThenBy(e => e.Id)
            .Select(TrajetoriaMapping.Map).ToList(),
        x.Projetos.OrderBy(p => p.Ordem).ThenBy(p => p.Id).Select(TrajetoriaMapping.Map).ToList(),
        new(x.CurriculoStorageKey is not null, x.CurriculoStorageKey is null ? null : $"/api/admin/alunos/{x.UserId}/curriculo"),
        x.AtualizadoEm);
}
