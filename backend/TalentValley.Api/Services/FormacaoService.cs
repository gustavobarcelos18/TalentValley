using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;
using TalentValley.Api.Storage;

namespace TalentValley.Api.Services;

public sealed class FormacaoService(AppDbContext database, IFileStorage storage, ILogger<FormacaoService> logger)
{
    public async Task<IReadOnlyCollection<FormacaoResponse>> ListAsync(Guid alunoId) =>
        (await database.Formacoes.AsNoTracking().Where(x => x.AlunoId == alunoId)
            .OrderByDescending(x => x.DataInicio).ThenBy(x => x.Id).ToListAsync())
        .Select(TrajetoriaMapping.Map).ToList();

    public async Task<FormacaoResponse> CreateAsync(Guid alunoId, FormacaoRequest request)
    {
        // SQLite's non-deferred transaction serializes principal selection and writes.
        await using var transaction = await database.Database.BeginTransactionAsync();
        var now = DateTimeOffset.UtcNow;
        if (request.Principal) await UnsetPrincipalAsync(alunoId, Guid.Empty, now);
        var item = new Formacao { Id = Guid.NewGuid(), AlunoId = alunoId, CriadoEm = now, AtualizadoEm = now };
        Apply(item, request);
        item.StatusValidacaoRpv = request.EhRioPombaValley ? StatusValidacaoRpv.PENDENTE : null;
        database.Formacoes.Add(item);
        await TouchAsync(alunoId, now);
        await database.SaveChangesAsync();
        await transaction.CommitAsync();
        return TrajetoriaMapping.Map(item);
    }

    public async Task<FormacaoResponse?> UpdateAsync(Guid alunoId, Guid id, FormacaoRequest request)
    {
        await using var transaction = await database.Database.BeginTransactionAsync();
        var item = await database.Formacoes.SingleOrDefaultAsync(x => x.AlunoId == alunoId && x.Id == id);
        if (item is null) return null;
        var relevantChange = item.Tipo != request.Tipo || item.Nome != request.Nome ||
            item.Instituicao != request.Instituicao || item.DataInicio != request.DataInicio ||
            item.DataFim != request.DataFim || item.CargaHoraria != request.CargaHoraria ||
            item.Status != request.Status || item.EhRioPombaValley != request.EhRioPombaValley;
        if (!relevantChange && item.Principal == request.Principal) return TrajetoriaMapping.Map(item);
        var now = DateTimeOffset.UtcNow;
        if (request.Principal) await UnsetPrincipalAsync(alunoId, id, now);
        Apply(item, request);
        if (relevantChange)
        {
            // Null means validation does not apply. A principal-only edit retains validation.
            item.StatusValidacaoRpv = request.EhRioPombaValley ? StatusValidacaoRpv.PENDENTE : null;
            item.ValidadoEm = null;
        }
        item.AtualizadoEm = now;
        await TouchAsync(alunoId, now);
        await database.SaveChangesAsync();
        await transaction.CommitAsync();
        return TrajetoriaMapping.Map(item);
    }

    public async Task<bool> DeleteAsync(Guid alunoId, Guid id)
    {
        await using var transaction = await database.Database.BeginTransactionAsync();
        var item = await database.Formacoes.SingleOrDefaultAsync(x => x.AlunoId == alunoId && x.Id == id);
        if (item is null) return false;
        var certificateKey = item.CertificadoStorageKey;
        database.Formacoes.Remove(item);
        await TouchAsync(alunoId, DateTimeOffset.UtcNow);
        await database.SaveChangesAsync();
        await transaction.CommitAsync();
        if (certificateKey is not null)
        {
            try { await storage.DeleteAsync(FileCategory.Certificate, certificateKey); }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to clean certificate file {StorageKey} after formation deletion.", certificateKey);
            }
        }
        return true;
    }

    private Task<int> UnsetPrincipalAsync(Guid alunoId, Guid exceptId, DateTimeOffset now) =>
        database.Formacoes.Where(x => x.AlunoId == alunoId && x.Id != exceptId && x.Principal)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Principal, false).SetProperty(x => x.AtualizadoEm, now));

    private async Task TouchAsync(Guid alunoId, DateTimeOffset now) =>
        (await database.Alunos.SingleAsync(x => x.UserId == alunoId)).AtualizadoEm = now;

    private static void Apply(Formacao item, FormacaoRequest request)
    {
        item.Tipo = request.Tipo!.Value;
        item.Nome = request.Nome;
        item.NomeBusca = NameNormalizer.Normalize(request.Nome);
        item.Instituicao = request.Instituicao;
        item.DataInicio = request.DataInicio!.Value;
        item.DataFim = request.DataFim;
        item.CargaHoraria = request.CargaHoraria;
        item.Status = request.Status!.Value;
        item.Principal = request.Principal;
        item.EhRioPombaValley = request.EhRioPombaValley;
    }
}
