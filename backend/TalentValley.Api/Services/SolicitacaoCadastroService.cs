using Microsoft.AspNetCore.Identity;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Services;

public enum SolicitacaoApprovalResult { Approved, NotFound, InvalidState, EmailUnavailable }
public sealed record SolicitacaoApprovalOutcome(SolicitacaoApprovalResult Result, Guid? UserId = null, bool ActivationSent = false);
public enum SolicitacaoRejectionResult { Rejected, NotFound, InvalidState }

public sealed class SolicitacaoCadastroService(AppDbContext database, UserManager<ApplicationUser> users,
    AdminAccountService accounts, AuditoriaService audit, SlugService slugs, IHttpContextAccessor context)
{
    // Bump when the published terms of use / privacy policy change.
    public const string VersaoTermosAtual = "1.0";

    public async Task CreateAlunoAsync(SolicitarCadastroAlunoRequest request, CancellationToken cancellationToken)
    {
        var entity = Base(request, TipoSolicitacaoCadastro.ALUNO);
        entity.InstituicaoEnsino = request.InstituicaoEnsino;
        entity.Curso = request.Curso;
        entity.TipoFormacao = request.TipoFormacao!.Value;
        entity.AnoConclusaoPrevisto = request.AnoConclusaoPrevisto;
        entity.RelacaoRioPombaValley = request.RelacaoRioPombaValley;
        await CreateAsync(entity, cancellationToken);
    }

    public async Task CreateRecrutadorAsync(SolicitarCadastroRecrutadorRequest request, CancellationToken cancellationToken)
    {
        var entity = Base(request, TipoSolicitacaoCadastro.RECRUTADOR);
        entity.Empresa = request.Empresa;
        entity.Cargo = request.Cargo;
        entity.SiteEmpresa = request.SiteEmpresa;
        await CreateAsync(entity, cancellationToken);
    }

    // A duplicate (existing account or pending request) is silently ignored so the caller cannot enumerate e-mails.
    private async Task CreateAsync(SolicitacaoCadastro entity, CancellationToken cancellationToken)
    {
        if (await users.FindByEmailAsync(entity.Email) is not null || await database.SolicitacoesCadastro
                .AnyAsync(x => x.EmailNormalizado == entity.EmailNormalizado && x.Status == StatusSolicitacaoCadastro.PENDENTE, cancellationToken))
            return;
        database.SolicitacoesCadastro.Add(entity);
        try { await database.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException exception) when (exception.InnerException is SqliteException { SqliteExtendedErrorCode: 2067 } sqlite &&
            sqlite.Message.Contains("SolicitacoesCadastro.EmailNormalizado", StringComparison.Ordinal))
        { /* Concurrent duplicate: same silent outcome. */ }
    }

    public async Task<PaginatedResponse<SolicitacaoCadastroListItem>> ListAsync(SolicitacaoCadastroListQuery request, CancellationToken cancellationToken)
    {
        var query = database.SolicitacoesCadastro.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = $"%{request.Search.Trim()}%";
            query = query.Where(x => EF.Functions.Like(x.NomeCompleto, search) || EF.Functions.Like(x.Email, search) ||
                (x.Empresa != null && EF.Functions.Like(x.Empresa, search)) ||
                (x.InstituicaoEnsino != null && EF.Functions.Like(x.InstituicaoEnsino, search)) ||
                (x.Curso != null && EF.Functions.Like(x.Curso, search)));
        }
        if (!string.IsNullOrEmpty(request.Tipo)) query = query.Where(x => x.Tipo == Enum.Parse<TipoSolicitacaoCadastro>(request.Tipo));
        if (!string.IsNullOrEmpty(request.Status)) query = query.Where(x => x.Status == Enum.Parse<StatusSolicitacaoCadastro>(request.Status));
        var total = await query.CountAsync(cancellationToken);
        var items = await query.OrderBy(x => x.Status == StatusSolicitacaoCadastro.PENDENTE ? 0 : 1).ThenByDescending(x => x.CriadoEm.ToString()).ThenBy(x => x.Id)
            .Skip((request.Page - 1) * 10).Take(10).Select(x => new SolicitacaoCadastroListItem(x.Id, x.Tipo, x.Status,
                x.NomeCompleto, x.Email, x.Telefone, x.Cidade, x.Uf, x.InstituicaoEnsino, x.Curso, x.TipoFormacao,
                x.AnoConclusaoPrevisto, x.Empresa, x.Cargo, x.CriadoEm)).ToListAsync(cancellationToken);
        return new(items, request.Page, 10, total, (int)Math.Ceiling(total / 10d));
    }

    public Task<SolicitacaoCadastroDetailResponse?> GetAsync(Guid id, CancellationToken cancellationToken) => database.SolicitacoesCadastro.AsNoTracking()
        .Where(x => x.Id == id).Select(x => new SolicitacaoCadastroDetailResponse(x.Id, x.Tipo, x.Status, x.NomeCompleto, x.Email,
            x.Telefone, x.Cidade, x.Uf, x.InstituicaoEnsino, x.Curso, x.TipoFormacao, x.AnoConclusaoPrevisto,
            x.RelacaoRioPombaValley, x.Empresa, x.Cargo, x.SiteEmpresa, x.CriadoEm, x.AnalisadoEm,
            x.AdminUser == null ? null : x.AdminUser.Email, x.MotivoRejeicao)).SingleOrDefaultAsync(cancellationToken);

    public async Task<SolicitacaoApprovalOutcome> ApproveAsync(Guid id, CancellationToken cancellationToken)
    {
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var request = await database.SolicitacoesCadastro.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (request is null) return new(SolicitacaoApprovalResult.NotFound);
        if (request.Status != StatusSolicitacaoCadastro.PENDENTE) return new(SolicitacaoApprovalResult.InvalidState);
        if (await users.FindByEmailAsync(request.Email) is not null) return new(SolicitacaoApprovalResult.EmailUnavailable);

        ApplicationUser user;
        try { user = await accounts.CreateAsync(request.NomeCompleto, request.Email, request.Tipo == TipoSolicitacaoCadastro.ALUNO ? AppRoles.Student : AppRoles.Recruiter); }
        catch (DuplicateAccountEmailException) { return new(SolicitacaoApprovalResult.EmailUnavailable); }
        if (request.Tipo == TipoSolicitacaoCadastro.ALUNO)
            database.Alunos.Add(new Aluno { UserId = user.Id, Slug = await slugs.GenerateAsync(user.NomeCompleto), Ativo = true,
                Cidade = request.Cidade, Uf = request.Uf, Telefone = request.Telefone, EmailProfissional = request.Email, AtualizadoEm = DateTimeOffset.UtcNow,
                ConsentimentoEm = request.ConsentimentoEm, VersaoTermos = request.VersaoTermos });
        else
            database.Recrutadores.Add(new Recrutador { UserId = user.Id, Empresa = request.Empresa!, EmpresaBusca = NameNormalizer.Normalize(request.Empresa!),
                Cargo = request.Cargo!, Telefone = request.Telefone, Cidade = request.Cidade, Uf = request.Uf, Status = StatusRecrutador.ATIVO });
        request.Status = StatusSolicitacaoCadastro.APROVADA;
        request.AnalisadoEm = DateTimeOffset.UtcNow;
        request.AdminUserId = CurrentAdminId();
        await audit.RecordAsync(AcaoAuditoria.SOLICITACAO_CADASTRO_APROVADA, "SOLICITACAO_CADASTRO", request.Id,
            $"Solicitação de cadastro de {request.NomeCompleto} aprovada.");
        if (request.Tipo == TipoSolicitacaoCadastro.ALUNO)
            await audit.RecordAsync(AcaoAuditoria.ALUNO_CRIADO, AppRoles.Student, user.Id, $"Aluno {request.NomeCompleto} criado por aprovação de solicitação.");
        else
            await audit.RecordAsync(AcaoAuditoria.RECRUTADOR_CRIADO, AppRoles.Recruiter, user.Id, $"Recrutador {request.NomeCompleto} criado por aprovação de solicitação.");
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        var activationSent = await accounts.TrySendActivationAsync(user);
        return new(SolicitacaoApprovalResult.Approved, user.Id, activationSent);
    }

    public async Task<SolicitacaoRejectionResult> RejectAsync(Guid id, string? reason, CancellationToken cancellationToken)
    {
        var request = await database.SolicitacoesCadastro.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (request is null) return SolicitacaoRejectionResult.NotFound;
        if (request.Status != StatusSolicitacaoCadastro.PENDENTE) return SolicitacaoRejectionResult.InvalidState;
        request.Status = StatusSolicitacaoCadastro.REJEITADA;
        request.AnalisadoEm = DateTimeOffset.UtcNow;
        request.AdminUserId = CurrentAdminId();
        request.MotivoRejeicao = reason;
        await audit.RecordAsync(AcaoAuditoria.SOLICITACAO_CADASTRO_REJEITADA, "SOLICITACAO_CADASTRO", request.Id,
            $"Solicitação de cadastro de {request.NomeCompleto} rejeitada.");
        await database.SaveChangesAsync(cancellationToken);
        return SolicitacaoRejectionResult.Rejected;
    }

    private static SolicitacaoCadastro Base(SolicitarCadastroBaseRequest request, TipoSolicitacaoCadastro type) => new()
    { Id = Guid.NewGuid(), Tipo = type, Status = StatusSolicitacaoCadastro.PENDENTE, NomeCompleto = request.NomeCompleto, Email = request.Email,
        EmailNormalizado = request.Email.ToUpperInvariant(), Telefone = request.Telefone, Cidade = request.Cidade, Uf = request.Uf, CriadoEm = DateTimeOffset.UtcNow,
        // Validation guarantees ConsentTermos is true; the server records when and which terms version was accepted.
        ConsentimentoEm = DateTimeOffset.UtcNow, VersaoTermos = VersaoTermosAtual };
    private Guid CurrentAdminId() => Guid.Parse(context.HttpContext!.User.FindFirst("sub")!.Value);
}
