using Microsoft.EntityFrameworkCore;
using System.Data;
using System.Data.Common;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Services;

public sealed class InvalidTalentQueryException(string message) : Exception(message);

public sealed class TalentDiscoveryService(AppDbContext database)
{
    private const int PageSize = 10;

    public async Task<PaginatedResponse<TalentListItem>> SearchAsync(
        Guid recruiterId, TalentSearchQuery request, CancellationToken cancellationToken)
    {
        var normalized = Normalize(request);
        await ValidateCompetenciesAsync(normalized.CompetencyIds, cancellationToken);

        var query = ApplyFilters(database.Alunos.AsNoTracking().Where(x => x.Ativo), normalized);
        var totalItems = await query.CountAsync(cancellationToken);
        var sort = normalized.Sort ?? (normalized.HasFilters ? TalentSort.RELEVANCIA : TalentSort.RECENTES);
        var offset = checked((normalized.Page - 1) * PageSize);

        // SQLite persists UTC DateTimeOffset values as sortable ISO text, while its EF provider
        // cannot translate DateTimeOffset ordering. Keep the complete ordered page selection in
        // parameterized SQL, then enrich only those ten IDs through EF.
        var pageIds = await LoadOrderedPageIdsAsync(normalized, sort, offset, cancellationToken);
        if (pageIds.Count == 0)
            return new([], normalized.Page, PageSize, totalItems, TotalPages(totalItems));

        var students = await PreviewQuery().Where(x => pageIds.Contains(x.UserId)).ToListAsync(cancellationToken);
        var favoriteIds = await database.Favoritos.AsNoTracking()
            .Where(x => x.RecrutadorId == recruiterId && pageIds.Contains(x.AlunoId))
            .Select(x => x.AlunoId).ToListAsync(cancellationToken);
        var favorites = favoriteIds.ToHashSet();
        var byId = students.ToDictionary(x => x.UserId);
        var items = pageIds.Select(id => MapListItem(byId[id], favorites.Contains(id))).ToList();
        return new(items, normalized.Page, PageSize, totalItems, TotalPages(totalItems));
    }

    public async Task<TalentProfileResponse?> GetBySlugAsync(
        Guid recruiterId, string slug, CancellationToken cancellationToken)
    {
        var student = await FullQuery().SingleOrDefaultAsync(
            x => x.Ativo && x.Slug == slug, cancellationToken);
        if (student is null) return null;
        var favorite = await database.Favoritos.AsNoTracking()
            .AnyAsync(x => x.RecrutadorId == recruiterId && x.AlunoId == student.UserId, cancellationToken);
        return MapProfile(student, favorite);
    }

    internal IQueryable<Aluno> PreviewQuery() => database.Alunos.AsNoTracking().AsSplitQuery()
        .Include(x => x.User)
        .Include(x => x.Competencias).ThenInclude(x => x.Competencia)
        .Include(x => x.Disponibilidades)
        .Include(x => x.Modalidades)
        .Include(x => x.Formacoes);

    internal IQueryable<Aluno> FullQuery() => PreviewQuery()
        .Include(x => x.Idiomas).ThenInclude(x => x.Idioma)
        .Include(x => x.Experiencias)
        .Include(x => x.Projetos).ThenInclude(x => x.Competencias).ThenInclude(x => x.Competencia);

    private static IQueryable<Aluno> ApplyFilters(IQueryable<Aluno> query, NormalizedQuery request)
    {
        if (request.Name is not null)
            query = query.Where(x => x.User.NomeBusca.Contains(request.Name));
        if (request.City is not null)
            query = query.Where(x => x.Cidade != null &&
                EF.Functions.Collate(x.Cidade.Trim(), "NOCASE") == request.City);
        if (request.Uf is not null)
            query = query.Where(x => x.Uf == request.Uf);
        if (request.CompetencyIds.Length > 0)
            query = query.Where(x =>
                x.Competencias.Any(c => request.CompetencyIds.Contains(c.CompetenciaId)) ||
                x.Projetos.Any(p => p.Competencias.Any(c => request.CompetencyIds.Contains(c.CompetenciaId))));

        if (request.HasEducationFilters)
            query = query.Where(x => x.Formacoes.Any(f =>
                (request.FormationTypes.Length == 0 || request.FormationTypes.Contains(f.Tipo)) &&
                (request.FormationName == null || f.NomeBusca.Contains(request.FormationName)) &&
                (request.FormationStatuses.Length == 0 || request.FormationStatuses.Contains(f.Status)) &&
                (!request.RpvVerified ||
                    (f.EhRioPombaValley && f.StatusValidacaoRpv == StatusValidacaoRpv.VERIFICADO))));

        if (request.Availabilities.Length > 0)
            query = query.Where(x => x.Disponibilidades.Any(d => request.Availabilities.Contains(d.Tipo)));
        if (request.Modalities.Length > 0)
            query = query.Where(x => x.Modalidades.Any(m => request.Modalities.Contains(m.Modalidade)));
        return query;
    }

    private async Task ValidateCompetenciesAsync(int[] ids, CancellationToken cancellationToken)
    {
        if (ids.Length == 0) return;
        var known = await database.Competencias.AsNoTracking()
            .Where(x => ids.Contains(x.Id)).Select(x => x.Id).ToListAsync(cancellationToken);
        var unknown = ids.Except(known).ToArray();
        if (unknown.Length > 0)
            throw new InvalidTalentQueryException($"Unknown competency IDs: {string.Join(", ", unknown)}");
    }

    private async Task<List<Guid>> LoadOrderedPageIdsAsync(
        NormalizedQuery request, TalentSort sort, int offset, CancellationToken cancellationToken)
    {
        var connection = database.Database.GetDbConnection();
        var shouldClose = connection.State != ConnectionState.Open;
        if (shouldClose) await connection.OpenAsync(cancellationToken);
        try
        {
            await using var command = connection.CreateCommand();
            var conditions = new List<string> { "a.\"Ativo\" = 1" };
            var parameterIndex = 0;

            string AddParameter(object value)
            {
                var name = $"@p{parameterIndex++}";
                var parameter = command.CreateParameter();
                parameter.ParameterName = name;
                parameter.Value = value;
                command.Parameters.Add(parameter);
                return name;
            }

            string InParameters<T>(IEnumerable<T> values) =>
                string.Join(", ", values.Select(value => AddParameter(value!)));

            if (request.Name is not null)
                conditions.Add($"instr(u.\"NomeBusca\", {AddParameter(request.Name)}) > 0");
            if (request.City is not null)
                conditions.Add($"trim(a.\"Cidade\") COLLATE NOCASE = {AddParameter(request.City)}");
            if (request.Uf is not null)
                conditions.Add($"a.\"Uf\" = {AddParameter(request.Uf)}");
            if (request.CompetencyIds.Length > 0)
            {
                var competencyParameters = InParameters(request.CompetencyIds);
                conditions.Add($"""
                    (EXISTS (
                        SELECT 1 FROM "AlunoCompetencias" ac
                        WHERE ac."AlunoId" = a."UserId" AND ac."CompetenciaId" IN ({competencyParameters})
                    ) OR EXISTS (
                        SELECT 1 FROM "Projetos" p
                        INNER JOIN "ProjetoCompetencias" pc ON pc."ProjetoId" = p."Id"
                        WHERE p."AlunoId" = a."UserId" AND pc."CompetenciaId" IN ({competencyParameters})
                    ))
                    """);
            }

            if (request.HasEducationFilters)
            {
                var formation = new List<string> { "f.\"AlunoId\" = a.\"UserId\"" };
                if (request.FormationTypes.Length > 0)
                    formation.Add($"f.\"Tipo\" IN ({InParameters(request.FormationTypes.Select(x => x.ToString()))})");
                if (request.FormationName is not null)
                    formation.Add($"instr(f.\"NomeBusca\", {AddParameter(request.FormationName)}) > 0");
                if (request.FormationStatuses.Length > 0)
                    formation.Add($"f.\"Status\" IN ({InParameters(request.FormationStatuses.Select(x => x.ToString()))})");
                if (request.RpvVerified)
                    formation.Add("f.\"EhRioPombaValley\" = 1 AND f.\"StatusValidacaoRpv\" = 'VERIFICADO'");
                conditions.Add($"EXISTS (SELECT 1 FROM \"Formacoes\" f WHERE {string.Join(" AND ", formation)})");
            }

            if (request.Availabilities.Length > 0)
                conditions.Add($"""
                    EXISTS (SELECT 1 FROM "AlunoDisponibilidades" d
                        WHERE d."AlunoId" = a."UserId" AND d."Tipo" IN ({InParameters(request.Availabilities.Select(x => x.ToString()))}))
                    """);
            if (request.Modalities.Length > 0)
                conditions.Add($"""
                    EXISTS (SELECT 1 FROM "AlunoModalidades" m
                        WHERE m."AlunoId" = a."UserId" AND m."Modalidade" IN ({InParameters(request.Modalities.Select(x => x.ToString()))}))
                    """);

            string orderBy;
            if (sort == TalentSort.RELEVANCIA)
            {
                var scoreParts = new List<string> { AddParameter(request.NonCompetencyFilterCount) };
                foreach (var competencyId in request.CompetencyIds)
                {
                    var generalId = AddParameter(competencyId);
                    var projectId = AddParameter(competencyId);
                    scoreParts.Add($"""
                        CASE
                            WHEN EXISTS (SELECT 1 FROM "AlunoCompetencias" rg
                                WHERE rg."AlunoId" = a."UserId" AND rg."CompetenciaId" = {generalId}) THEN 2
                            WHEN EXISTS (SELECT 1 FROM "Projetos" rp
                                INNER JOIN "ProjetoCompetencias" rpc ON rpc."ProjetoId" = rp."Id"
                                WHERE rp."AlunoId" = a."UserId" AND rpc."CompetenciaId" = {projectId}) THEN 1
                            ELSE 0
                        END
                        """);
                }
                orderBy = $"({string.Join(" + ", scoreParts)}) DESC, a.\"AtualizadoEm\" DESC, u.\"NomeBusca\" ASC, a.\"UserId\" ASC";
            }
            else if (sort == TalentSort.NOME)
                orderBy = "u.\"NomeBusca\" ASC, a.\"UserId\" ASC";
            else
                orderBy = "a.\"AtualizadoEm\" DESC, u.\"NomeBusca\" ASC, a.\"UserId\" ASC";

            var limitParameter = AddParameter(PageSize);
            var offsetParameter = AddParameter(offset);
            command.CommandText = $"""
                SELECT a."UserId"
                FROM "Alunos" a
                INNER JOIN "AspNetUsers" u ON u."Id" = a."UserId"
                WHERE {string.Join(" AND ", conditions)}
                ORDER BY {orderBy}
                LIMIT {limitParameter} OFFSET {offsetParameter}
                """;

            var ids = new List<Guid>();
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
                ids.Add(Guid.Parse(reader.GetString(0)));
            return ids;
        }
        finally
        {
            if (shouldClose) await connection.CloseAsync();
        }
    }

    private static NormalizedQuery Normalize(TalentSearchQuery request) => new(
        request.Page,
        NormalizeText(request.Nome, true),
        NormalizeText(request.Cidade, false),
        string.IsNullOrWhiteSpace(request.Uf) ? null : request.Uf.Trim().ToUpperInvariant(),
        request.CompetenciaIds.Distinct().Order().ToArray(),
        request.TiposFormacao.Distinct().ToArray(),
        NormalizeText(request.FormacaoNome, true),
        request.StatusFormacao.Distinct().ToArray(),
        request.RpvVerificado == true,
        request.Disponibilidades.Distinct().ToArray(),
        request.Modalidades.Distinct().ToArray(),
        request.Ordenacao);

    private static string? NormalizeText(string? value, bool searchNormalized)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var trimmed = value.Trim();
        return searchNormalized ? NameNormalizer.Normalize(trimmed) : trimmed;
    }

    private static int TotalPages(int totalItems) =>
        totalItems / PageSize + (totalItems % PageSize == 0 ? 0 : 1);
    private static bool IsVerified(Formacao formation) => formation.EhRioPombaValley &&
        formation.StatusValidacaoRpv == StatusValidacaoRpv.VERIFICADO;
    private static string PhotoUrl(Aluno student) => $"/api/talentos/{student.Slug}/foto";
    private static string CurriculumUrl(Aluno student) => $"/api/talentos/{student.Slug}/curriculo";
    private static string CertificateUrl(Aluno student, Formacao formation) =>
        $"/api/talentos/{student.Slug}/formacoes/{formation.Id}/certificado";

    internal static TalentListItem MapListItem(Aluno x, bool favorite)
    {
        var principal = x.Formacoes.SingleOrDefault(f => f.Principal);
        return new(x.UserId, x.Slug, x.User.NomeCompleto,
            x.FotoStorageKey is null ? null : PhotoUrl(x), x.Cidade, x.Uf, x.Bio,
            x.Competencias.OrderBy(c => c.Competencia.NomeBusca).ThenBy(c => c.CompetenciaId)
                .Select(c => new TalentCompetencyResponse(c.CompetenciaId, c.Competencia.Nome)).ToList(),
            principal is null ? null : new(principal.Tipo, principal.Nome, principal.Instituicao, IsVerified(principal)),
            x.Disponibilidades.OrderBy(d => d.Tipo).Select(d => d.Tipo).ToList(),
            x.Modalidades.OrderBy(m => m.Modalidade).Select(m => m.Modalidade).ToList(),
            favorite,
            x.AtualizadoEm);
    }

    internal static TalentProfileResponse MapProfile(Aluno x, bool favorite) => new(
        x.UserId, x.Slug, x.User.NomeCompleto, x.FotoStorageKey is null ? null : PhotoUrl(x),
        x.Cidade, x.Uf,
        new(x.Telefone, x.EmailProfissional, x.LinkedInUrl, x.GitHubUrl, x.PortfolioUrl),
        x.Bio,
        x.Competencias.OrderBy(c => c.Competencia.NomeBusca).ThenBy(c => c.CompetenciaId)
            .Select(c => new TalentCompetencyResponse(c.CompetenciaId, c.Competencia.Nome)).ToList(),
        x.Idiomas.OrderBy(i => i.Idioma.NomeBusca).ThenBy(i => i.IdiomaId)
            .Select(i => new TalentLanguageResponse(i.IdiomaId, i.Idioma.Nome, i.Nivel)).ToList(),
        x.Disponibilidades.OrderBy(d => d.Tipo).Select(d => d.Tipo).ToList(),
        x.Modalidades.OrderBy(m => m.Modalidade).Select(m => m.Modalidade).ToList(),
        x.Formacoes.OrderByDescending(f => f.Principal).ThenByDescending(f => f.DataInicio).ThenBy(f => f.Id)
            .Select(f => new TalentFormationResponse(f.Id, f.Tipo, f.Nome, f.Instituicao,
                f.DataInicio, f.DataFim, f.CargaHoraria, f.Status, f.Principal, IsVerified(f),
                f.CertificadoStorageKey is not null,
                f.CertificadoStorageKey is null ? null : CertificateUrl(x, f))).ToList(),
        x.Experiencias.OrderByDescending(e => e.Atual).ThenByDescending(e => e.DataInicio).ThenBy(e => e.Id)
            .Select(e => new TalentExperienceResponse(e.Id, e.Empresa, e.Cargo, e.Tipo,
                e.DataInicio, e.DataFim, e.Atual, e.Descricao)).ToList(),
        x.Projetos.OrderBy(p => p.Ordem).ThenBy(p => p.Id)
            .Select(p => new TalentProjectResponse(p.Id, p.Ordem, p.Nome, p.DataInicio,
                p.DataFim, p.EmAndamento, p.Descricao, p.DemoUrl, p.RepositorioUrl,
                p.Competencias.OrderBy(c => c.Competencia.NomeBusca).ThenBy(c => c.CompetenciaId)
                    .Select(c => new TalentCompetencyResponse(c.CompetenciaId, c.Competencia.Nome)).ToList())).ToList(),
        new(x.CurriculoStorageKey is not null, x.CurriculoStorageKey is null ? null : CurriculumUrl(x)),
        favorite,
        x.AtualizadoEm);

    private sealed record NormalizedQuery(
        int Page, string? Name, string? City, string? Uf, int[] CompetencyIds,
        TipoFormacao[] FormationTypes, string? FormationName, StatusFormacao[] FormationStatuses,
        bool RpvVerified, TipoDisponibilidade[] Availabilities, ModalidadeTrabalho[] Modalities,
        TalentSort? Sort)
    {
        public bool HasEducationFilters => FormationTypes.Length > 0 || FormationName is not null ||
            FormationStatuses.Length > 0 || RpvVerified;
        public int NonCompetencyFilterCount =>
            (Name is null ? 0 : 1) + (City is null ? 0 : 1) + (Uf is null ? 0 : 1) +
            (FormationTypes.Length == 0 ? 0 : 1) + (FormationName is null ? 0 : 1) +
            (FormationStatuses.Length == 0 ? 0 : 1) + (RpvVerified ? 1 : 0) +
            (Availabilities.Length == 0 ? 0 : 1) + (Modalities.Length == 0 ? 0 : 1);
        public bool HasFilters => NonCompetencyFilterCount > 0 || CompetencyIds.Length > 0;
    }
}
