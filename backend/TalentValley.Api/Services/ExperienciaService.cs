using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Services;

public sealed class ExperienciaService(AppDbContext database)
{
    public async Task<IReadOnlyCollection<ExperienciaResponse>> ListAsync(Guid alunoId) =>
        (await database.Experiencias.AsNoTracking().Where(x => x.AlunoId == alunoId)
            .OrderByDescending(x => x.DataInicio).ThenBy(x => x.Id).ToListAsync())
        .Select(TrajetoriaMapping.Map).ToList();

    public async Task<ExperienciaResponse> CreateAsync(Guid alunoId, ExperienciaRequest request)
    {
        var now = DateTimeOffset.UtcNow;
        var item = new Experiencia { Id = Guid.NewGuid(), AlunoId = alunoId, CriadoEm = now, AtualizadoEm = now };
        Apply(item, request);
        database.Experiencias.Add(item);
        await TouchAsync(alunoId, now);
        await database.SaveChangesAsync();
        return TrajetoriaMapping.Map(item);
    }

    public async Task<ExperienciaResponse?> UpdateAsync(Guid alunoId, Guid id, ExperienciaRequest request)
    {
        var item = await database.Experiencias.SingleOrDefaultAsync(x => x.AlunoId == alunoId && x.Id == id);
        if (item is null) return null;
        var before = TrajetoriaMapping.Map(item);
        Apply(item, request);
        if (before == TrajetoriaMapping.Map(item)) return before;
        item.AtualizadoEm = DateTimeOffset.UtcNow;
        await TouchAsync(alunoId, item.AtualizadoEm);
        await database.SaveChangesAsync();
        return TrajetoriaMapping.Map(item);
    }

    public async Task<bool> DeleteAsync(Guid alunoId, Guid id)
    {
        var item = await database.Experiencias.SingleOrDefaultAsync(x => x.AlunoId == alunoId && x.Id == id);
        if (item is null) return false;
        database.Experiencias.Remove(item);
        await TouchAsync(alunoId, DateTimeOffset.UtcNow);
        await database.SaveChangesAsync();
        return true;
    }

    private async Task TouchAsync(Guid alunoId, DateTimeOffset now) =>
        (await database.Alunos.SingleAsync(x => x.UserId == alunoId)).AtualizadoEm = now;

    private static void Apply(Experiencia item, ExperienciaRequest request)
    {
        item.Empresa = request.Empresa;
        item.Cargo = request.Cargo;
        item.Tipo = request.Tipo!.Value;
        item.DataInicio = request.DataInicio!.Value;
        item.DataFim = request.Atual ? null : request.DataFim;
        item.Atual = request.Atual;
        item.Descricao = request.Descricao;
    }
}
