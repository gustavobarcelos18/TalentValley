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
public enum SolicitacaoRejectionResult { Rejected, NotFound, InvalidState }

public sealed class SolicitacaoCadastroService(AppDbContext database, UserManager<ApplicationUser> users,
    AdminAccountService accounts, AuditoriaService audit, SlugService slugs, IHttpContextAccessor context)
{
    private const string ExistingRequestMessage = "Já existe uma conta ou solicitação em andamento para este e-mail.";

    public async Task<SolicitacaoCadastroCreatedResponse> CreateAlunoAsync(SolicitarCadastroAlunoRequest request, CancellationToken cancellationToken)
    {
        var entity = Base(request, TipoSolicitacaoCadastro.ALUNO);
        entity.InstituicaoEnsino = request.InstituicaoEnsino;
        entity.Curso = request.Curso;
        entity.TipoFormacao = request.TipoFormacao!.Value;
        entity.AnoConclusaoPrevisto = request.AnoConclusaoPrevisto;
        entity.RelacaoRioPombaValley = request.RelacaoRioPombaValley;
        return await CreateAsync(entity, cancellationToken);
    }

    public async Task<SolicitacaoCadastroCreatedResponse> CreateRecrutadorAsync(SolicitarCadastroRecrutadorRequest request, CancellationToken cancellationToken)
    {
        var entity = Base(request, TipoSolicitacaoCadastro.RECRUTADOR);
        entity.Empresa = request.Empresa;
        entity.Cargo = request.Cargo;
        entity.SiteEmpresa = request.SiteEmpresa;
        return await CreateAsync(entity, cancellationToken);
    }

    private async Task<SolicitacaoCadastroCreatedResponse> CreateAsync(SolicitacaoCadastro entity, CancellationToken cancellationToken)
    {
        if (await users.FindByEmailAsync(entity.Email) is not null || await database.SolicitacoesCadastro
                .AnyAsync(x => x.EmailNormalizado == entity.EmailNormalizado && x.Status == StatusSolicitacaoCadastro.PENDENTE, cancellationToken))
            throw new DuplicateRegistrationException();
        database.SolicitacoesCadastro.Add(entity);
        try { await database.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException exception) when (exception.InnerException is SqliteException { SqliteExtendedErrorCode: 2067 } sqlite &&
            sqlite.Message.Contains("SolicitacoesCadastro.EmailNormalizado", StringComparison.Ordinal))
        { throw new DuplicateRegistrationException(); }
        return new(entity.Id, entity.Status);
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
        var items = await query.OrderBy(x => x.Status == StatusSolicitacaoCadastro.PENDENTE ? 0 : 1).ThenByDescending(x => x.CriadoEm).ThenBy(x => x.Id)
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

    public async Task<SolicitacaoApprovalResult> ApproveAsync(Guid id, CancellationToken cancellationToken)
    {
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var request = await database.SolicitacoesCadastro.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (request is null) return SolicitacaoApprovalResult.NotFound;
        if (request.Status != StatusSolicitacaoCadastro.PENDENTE) return SolicitacaoApprovalResult.InvalidState;
        if (await users.FindByEmailAsync(request.Email) is not null) return SolicitacaoApprovalResult.EmailUnavailable;

        ApplicationUser user;
        try { user = await accounts.CreateAsync(request.NomeCompleto, request.Email, request.Tipo == TipoSolicitacaoCadastro.ALUNO ? AppRoles.Student : AppRoles.Recruiter); }
        catch (DuplicateAccountEmailException) { return SolicitacaoApprovalResult.EmailUnavailable; }
        if (request.Tipo == TipoSolicitacaoCadastro.ALUNO)
            database.Alunos.Add(new Aluno { UserId = user.Id, Slug = await slugs.GenerateAsync(user.NomeCompleto), Ativo = true,
                Cidade = request.Cidade, Uf = request.Uf, Telefone = request.Telefone, EmailProfissional = request.Email, AtualizadoEm = DateTimeOffset.UtcNow });
        else
            database.Recrutadores.Add(new Recrutador { UserId = user.Id, Empresa = request.Empresa!, EmpresaBusca = NameNormalizer.Normalize(request.Empresa!),
                Cargo = request.Cargo!, Telefone = request.Telefone, Cidade = request.Cidade, Uf = request.Uf, Status = StatusRecrutador.ATIVO });
        request.Status = StatusSolicitacaoCadastro.APROVADA;
        request.AnalisadoEm = DateTimeOffset.UtcNow;
        request.AdminUserId = CurrentAdminId();
        await audit.RecordAsync(AcaoAuditoria.SOLICITACAO_CADASTRO_APROVADA, "SOLICITACAO_CADASTRO", request.Id,
            $"Solicitação de cadastro de {request.NomeCompleto} aprovada.");
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        await accounts.TrySendActivationAsync(user);
        return SolicitacaoApprovalResult.Approved;
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
        EmailNormalizado = request.Email.ToUpperInvariant(), Telefone = request.Telefone, Cidade = request.Cidade, Uf = request.Uf, CriadoEm = DateTimeOffset.UtcNow };
    private Guid CurrentAdminId() => Guid.Parse(context.HttpContext!.User.FindFirst("sub")!.Value);
}

public sealed class DuplicateRegistrationException : Exception
{
    public const string MessageForClient = "Já existe uma conta ou solicitação em andamento para este e-mail.";
}
