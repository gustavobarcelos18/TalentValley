using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Services;

public sealed class ProjectLimitException : Exception;

public sealed class ProjetoService(AppDbContext database)
{
    public async Task<IReadOnlyCollection<ProjetoResponse>> ListAsync(Guid alunoId) =>
        (await Query().AsNoTracking().Where(x => x.AlunoId == alunoId).OrderBy(x => x.Ordem).ToListAsync())
        .Select(TrajetoriaMapping.Map).ToList();

    public async Task<ProjetoResponse> CreateAsync(Guid alunoId, ProjetoRequest request)
    {
        // Acquire SQLite's write reservation before counting or reading occupied orders.
        await using var transaction = await database.Database.BeginTransactionAsync();
        var items = await Query().Where(x => x.AlunoId == alunoId).ToListAsync();
        if (items.Count >= 2) throw new ProjectLimitException();
        var competencies = await LoadCompetenciesAsync(request.CompetenciaIds);
        var now = DateTimeOffset.UtcNow;
        var occupied = items.SingleOrDefault(x => x.Ordem == request.Ordem);
        if (occupied is not null)
        {
            occupied.Ordem = 3 - request.Ordem;
            occupied.AtualizadoEm = now;
            await database.SaveChangesAsync();
        }
        var item = new Projeto { Id = Guid.NewGuid(), AlunoId = alunoId, CriadoEm = now, AtualizadoEm = now };
        Apply(item, request);
        ReplaceCompetencies(item, competencies);
        database.Projetos.Add(item);
        await TouchAsync(alunoId, now);
        await database.SaveChangesAsync();
        await transaction.CommitAsync();
        return TrajetoriaMapping.Map(item);
    }

    public async Task<ProjetoResponse?> UpdateAsync(Guid alunoId, Guid id, ProjetoRequest request)
    {
        await using var transaction = await database.Database.BeginTransactionAsync();
        var items = await Query().Where(x => x.AlunoId == alunoId).ToListAsync();
        var item = items.SingleOrDefault(x => x.Id == id);
        if (item is null) return null;
        var competencies = await LoadCompetenciesAsync(request.CompetenciaIds);
        var oldOrder = item.Ordem;
        var sameCompetencies = item.Competencias.Select(x => x.CompetenciaId).ToHashSet().SetEquals(request.CompetenciaIds);
        Apply(item, request);
        database.ChangeTracker.DetectChanges();
        if (database.Entry(item).State == EntityState.Unchanged && sameCompetencies)
            return TrajetoriaMapping.Map(item);
        var now = DateTimeOffset.UtcNow;
        var occupied = items.SingleOrDefault(x => x.Id != id && x.Ordem == request.Ordem);
        if (occupied is not null)
        {
            // Both the unique index and CHECK allow no spare order. Delete only the other row
            // (and its joins) inside this transaction, move this row, then restore the other
            // with the same identity, creation timestamp, fields and technology references.
            // ExecuteDelete avoids flushing this row's conflicting tracked order prematurely.
            await database.Projetos.Where(x => x.AlunoId == alunoId && x.Id == occupied.Id).ExecuteDeleteAsync();
            await database.SaveChangesAsync();
            occupied.Ordem = oldOrder;
            occupied.AtualizadoEm = now;
            database.Entry(occupied).State = EntityState.Added;
            foreach (var link in occupied.Competencias) database.Entry(link).State = EntityState.Added;
        }
        ReplaceCompetencies(item, competencies);
        item.AtualizadoEm = now;
        await TouchAsync(alunoId, now);
        await database.SaveChangesAsync();
        await transaction.CommitAsync();
        return TrajetoriaMapping.Map(item);
    }

    public async Task<bool> DeleteAsync(Guid alunoId, Guid id)
    {
        await using var transaction = await database.Database.BeginTransactionAsync();
        var item = await database.Projetos.SingleOrDefaultAsync(x => x.AlunoId == alunoId && x.Id == id);
        if (item is null) return false;
        database.Projetos.Remove(item);
        await database.SaveChangesAsync(); // Free order 1 before compaction.
        var remaining = await database.Projetos.SingleOrDefaultAsync(x => x.AlunoId == alunoId);
        var now = DateTimeOffset.UtcNow;
        if (remaining is not null && remaining.Ordem != 1)
        {
            remaining.Ordem = 1;
            remaining.AtualizadoEm = now;
        }
        await TouchAsync(alunoId, now);
        await database.SaveChangesAsync();
        await transaction.CommitAsync();
        return true;
    }

    private IQueryable<Projeto> Query() => database.Projetos.Include(x => x.Competencias).ThenInclude(x => x.Competencia);

    private async Task<List<Competencia>> LoadCompetenciesAsync(IReadOnlyCollection<int> ids)
    {
        if (ids.Distinct().Count() != ids.Count) throw new ArgumentException("Duplicate competency IDs in request.");
        var competencies = await database.Competencias.Where(x => ids.Contains(x.Id)).ToListAsync();
        if (competencies.Count != ids.Count) throw new ArgumentException("Unknown competency IDs in request.");
        return competencies;
    }

    private static void ReplaceCompetencies(Projeto item, List<Competencia> competencies)
    {
        var desired = competencies.Select(x => x.Id).ToHashSet();
        foreach (var link in item.Competencias.Where(x => !desired.Contains(x.CompetenciaId)).ToList())
            item.Competencias.Remove(link);
        foreach (var competency in competencies.Where(c => item.Competencias.All(x => x.CompetenciaId != c.Id)))
            item.Competencias.Add(new() { ProjetoId = item.Id, CompetenciaId = competency.Id, Competencia = competency });
    }

    private async Task TouchAsync(Guid alunoId, DateTimeOffset now) =>
        (await database.Alunos.SingleAsync(x => x.UserId == alunoId)).AtualizadoEm = now;

    private static void Apply(Projeto item, ProjetoRequest request)
    {
        item.Ordem = request.Ordem;
        item.Nome = request.Nome;
        item.DataInicio = request.DataInicio!.Value;
        item.DataFim = request.EmAndamento ? null : request.DataFim;
        item.EmAndamento = request.EmAndamento;
        item.Descricao = request.Descricao;
        item.DemoUrl = request.DemoUrl;
        item.RepositorioUrl = request.RepositorioUrl;
    }
}
