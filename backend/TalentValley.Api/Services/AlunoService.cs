using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Services;

public sealed class AlunoProfileNotFoundException : Exception;
public sealed class InvalidUrlException : Exception
{
    public InvalidUrlException(string message) : base(message) { }
}

public sealed class AlunoService(AppDbContext database)
{
    public async Task<MeResponse?> GetProfileAsync(Guid userId)
    {
        var aluno = await database.Alunos.AsNoTracking()
            .Include(x => x.User)
            .Include(x => x.Competencias).ThenInclude(x => x.Competencia)
            .Include(x => x.Idiomas).ThenInclude(x => x.Idioma)
            .Include(x => x.Disponibilidades)
            .Include(x => x.Modalidades)
            .Include(x => x.Formacoes)
            .Include(x => x.Experiencias)
            .Include(x => x.Projetos)
            .SingleOrDefaultAsync(x => x.UserId == userId);

        return aluno is null ? null : MapToResponse(aluno);
    }

    public async Task UpdateDadosBasicosAsync(Guid userId, UpdateDadosBasicosRequest request)
    {
        var aluno = await LoadAsync(userId);
        var nomeBusca = NameNormalizer.Normalize(request.NomeCompleto);
        if (aluno.User.NomeCompleto == request.NomeCompleto &&
            aluno.User.NomeBusca == nomeBusca &&
            aluno.Cidade == request.Cidade &&
            aluno.Uf == request.Uf)
            return;

        aluno.User.NomeCompleto = request.NomeCompleto;
        aluno.User.NomeBusca = nomeBusca;
        aluno.Cidade = request.Cidade;
        aluno.Uf = request.Uf;
        Touch(aluno);
        await database.SaveChangesAsync();
    }

    public async Task UpdateSobreAsync(Guid userId, UpdateSobreRequest request)
    {
        var aluno = await LoadAsync(userId);
        if (aluno.Bio == request.Bio) return;
        aluno.Bio = request.Bio;
        Touch(aluno);
        await database.SaveChangesAsync();
    }

    public async Task UpdateContatoAsync(Guid userId, UpdateContatoRequest request)
    {
        ValidateContactUrls(request);
        var aluno = await LoadAsync(userId);
        if (aluno.Telefone == request.Telefone &&
            aluno.EmailProfissional == request.EmailProfissional &&
            aluno.LinkedInUrl == request.LinkedInUrl &&
            aluno.GitHubUrl == request.GitHubUrl &&
            aluno.PortfolioUrl == request.PortfolioUrl)
            return;

        aluno.Telefone = request.Telefone;
        aluno.EmailProfissional = request.EmailProfissional;
        aluno.LinkedInUrl = request.LinkedInUrl;
        aluno.GitHubUrl = request.GitHubUrl;
        aluno.PortfolioUrl = request.PortfolioUrl;
        Touch(aluno);
        await database.SaveChangesAsync();
    }

    public async Task UpdateCompetenciasAsync(Guid userId, IReadOnlyCollection<int> competenciaIds)
    {
        var aluno = await LoadAsync(userId);
        var desired = competenciaIds.Distinct().ToHashSet();
        var current = aluno.Competencias.Select(x => x.CompetenciaId).ToHashSet();
        if (current.SetEquals(desired)) return;
        var knownIds = await database.Competencias
            .Where(x => desired.Contains(x.Id)).Select(x => x.Id).ToHashSetAsync();
        var unknown = desired.Except(knownIds).ToList();
        if (unknown.Count > 0) throw new ArgumentException($"Unknown competency IDs: {string.Join(", ", unknown)}");
        foreach (var item in aluno.Competencias.Where(x => !desired.Contains(x.CompetenciaId)).ToList())
            aluno.Competencias.Remove(item);
        foreach (var id in desired.Where(x => !current.Contains(x)))
            aluno.Competencias.Add(new() { CompetenciaId = id });
        Touch(aluno);
        await database.SaveChangesAsync();
    }

    public async Task UpdateIdiomasAsync(Guid userId, IReadOnlyCollection<ItemIdiomaRequest> idiomas)
    {
        var aluno = await LoadAsync(userId);
        var requestedIds = idiomas.Select(x => x.IdiomaId).ToList();
        if (requestedIds.Distinct().Count() != requestedIds.Count)
            throw new ArgumentException("Duplicate language IDs in request.");
        var desired = idiomas.ToDictionary(x => x.IdiomaId, x => x.Nivel);
        var current = aluno.Idiomas.ToDictionary(x => x.IdiomaId, x => x.Nivel);
        if (current.Count == desired.Count && desired.All(kvp => current.TryGetValue(kvp.Key, out var v) && v == kvp.Value))
            return;
        var knownIds = await database.Idiomas
            .Where(x => desired.Keys.Contains(x.Id)).Select(x => x.Id).ToHashSetAsync();
        var unknown = desired.Keys.Except(knownIds).ToList();
        if (unknown.Count > 0) throw new ArgumentException($"Unknown language IDs: {string.Join(", ", unknown)}");
        foreach (var item in aluno.Idiomas.Where(x => !desired.ContainsKey(x.IdiomaId)).ToList())
            aluno.Idiomas.Remove(item);
        foreach (var (idiomaId, nivel) in desired)
        {
            var existing = aluno.Idiomas.FirstOrDefault(x => x.IdiomaId == idiomaId);
            if (existing is not null) existing.Nivel = nivel;
            else aluno.Idiomas.Add(new() { IdiomaId = idiomaId, Nivel = nivel });
        }
        Touch(aluno);
        await database.SaveChangesAsync();
    }

    public async Task UpdateDisponibilidadeAsync(Guid userId, UpdateDisponibilidadeRequest request)
    {
        var aluno = await LoadAsync(userId);
        var desiredDisp = request.Disponibilidades.Distinct().ToHashSet();
        var desiredMod = request.Modalidades.Distinct().ToHashSet();
        var currentDisp = aluno.Disponibilidades.Select(x => x.Tipo).ToHashSet();
        var currentMod = aluno.Modalidades.Select(x => x.Modalidade).ToHashSet();
        if (currentDisp.SetEquals(desiredDisp) && currentMod.SetEquals(desiredMod)) return;
        foreach (var item in aluno.Disponibilidades.Where(x => !desiredDisp.Contains(x.Tipo)).ToList())
            aluno.Disponibilidades.Remove(item);
        foreach (var tipo in desiredDisp.Where(x => !currentDisp.Contains(x)))
            aluno.Disponibilidades.Add(new() { Tipo = tipo });
        foreach (var item in aluno.Modalidades.Where(x => !desiredMod.Contains(x.Modalidade)).ToList())
            aluno.Modalidades.Remove(item);
        foreach (var mod in desiredMod.Where(x => !currentMod.Contains(x)))
            aluno.Modalidades.Add(new() { Modalidade = mod });
        Touch(aluno);
        await database.SaveChangesAsync();
    }

    public async Task<IReadOnlyCollection<CatalogoCompetenciaResponse>> GetCompetenciasAsync(string? search)
    {
        var query = database.Competencias.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var normalized = NameNormalizer.Normalize(search);
            query = query.Where(x => x.NomeBusca.Contains(normalized));
        }
        return await query.OrderBy(x => x.NomeBusca)
            .Select(x => new CatalogoCompetenciaResponse(x.Id, x.Nome)).ToListAsync();
    }

    public async Task<IReadOnlyCollection<CatalogoIdiomaResponse>> GetIdiomasAsync() =>
        await database.Idiomas.AsNoTracking().OrderBy(x => x.NomeBusca)
            .Select(x => new CatalogoIdiomaResponse(x.Id, x.Nome)).ToListAsync();

    private static void ValidateContactUrls(UpdateContatoRequest request)
    {
        if (!string.IsNullOrEmpty(request.LinkedInUrl) && !IsValidHttpUrl(request.LinkedInUrl))
            throw new InvalidUrlException("LinkedInUrl must be a valid http(s) URL.");
        if (!string.IsNullOrEmpty(request.GitHubUrl) && !IsValidHttpUrl(request.GitHubUrl))
            throw new InvalidUrlException("GitHubUrl must be a valid http(s) URL.");
        if (!string.IsNullOrEmpty(request.PortfolioUrl) && !IsValidHttpUrl(request.PortfolioUrl))
            throw new InvalidUrlException("PortfolioUrl must be a valid http(s) URL.");
    }

    private static bool IsValidHttpUrl(string url) =>
        Uri.TryCreate(url, UriKind.Absolute, out var uri) &&
        (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);

    private async Task<Aluno> LoadAsync(Guid userId)
    {
        var aluno = await database.Alunos.Include(x => x.User)
            .Include(x => x.Competencias)
            .Include(x => x.Idiomas)
            .Include(x => x.Disponibilidades)
            .Include(x => x.Modalidades)
            .SingleOrDefaultAsync(x => x.UserId == userId);
        return aluno ?? throw new AlunoProfileNotFoundException();
    }

    private static void Touch(Aluno aluno) => aluno.AtualizadoEm = DateTimeOffset.UtcNow;

    private static MeResponse MapToResponse(Aluno aluno) => new(
        aluno.UserId,
        aluno.Slug,
        new(aluno.User.NomeCompleto, null, aluno.Cidade, aluno.Uf),
        new(aluno.Bio),
        new(aluno.Telefone, aluno.EmailProfissional, aluno.LinkedInUrl, aluno.GitHubUrl, aluno.PortfolioUrl),
        aluno.Competencias.OrderBy(x => x.Competencia.NomeBusca)
            .Select(x => new CompetenciaResponse(x.CompetenciaId, x.Competencia.Nome)).ToList(),
        aluno.Idiomas.OrderBy(x => x.Idioma.NomeBusca)
            .Select(x => new AlunoIdiomaResponse(x.IdiomaId, x.Idioma.Nome, x.Nivel)).ToList(),
        aluno.Disponibilidades.OrderBy(x => x.Tipo).Select(x => x.Tipo).ToList(),
        aluno.Modalidades.OrderBy(x => x.Modalidade).Select(x => x.Modalidade).ToList(),
        aluno.Formacoes.OrderBy(x => x.CriadoEm)
            .Select(x => new FormacaoResponse(x.Id, x.Tipo, x.Nome, x.Instituicao)).ToList(),
        aluno.Experiencias.OrderByDescending(x => x.DataInicio)
            .Select(x => new ExperienciaResponse(x.Id, x.Empresa, x.Cargo, x.Tipo)).ToList(),
        aluno.Projetos.OrderBy(x => x.Ordem)
            .Select(x => new ProjetoResponse(x.Id, x.Ordem, x.Nome, x.Descricao)).ToList(),
        new(aluno.CurriculoStorageKey is not null, null),
        aluno.AtualizadoEm);
}
