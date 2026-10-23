using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Services;

// LGPD access/portability: each person receives only their own data, identified by the authenticated user ID.
public sealed class DataExportService(AppDbContext database)
{
    public async Task<ExportacaoAlunoResponse?> ExportAlunoAsync(Guid userId, CancellationToken cancellationToken)
    {
        var aluno = await database.Alunos.AsNoTracking().AsSplitQuery()
            .Include(x => x.User)
            .Include(x => x.Competencias).ThenInclude(x => x.Competencia)
            .Include(x => x.Idiomas).ThenInclude(x => x.Idioma)
            .Include(x => x.Disponibilidades)
            .Include(x => x.Modalidades)
            .Include(x => x.AreasInteresse)
            .Include(x => x.CategoriasCnh)
            .Include(x => x.TiposDeficiencia)
            .Include(x => x.Formacoes)
            .Include(x => x.Experiencias)
            .Include(x => x.Projetos).ThenInclude(x => x.Competencias).ThenInclude(x => x.Competencia)
            .SingleOrDefaultAsync(x => x.UserId == userId, cancellationToken);
        if (aluno is null) return null;

        return new(
            DateTimeOffset.UtcNow,
            MapAccount(aluno.User),
            new(aluno.ConsentimentoEm, aluno.VersaoTermos, aluno.NewsletterAceita, aluno.NewsletterAtualizadaEm),
            aluno.Slug,
            aluno.Ativo,
            new(aluno.User.NomeCompleto, aluno.Cidade, aluno.Uf),
            new(aluno.Bio),
            new(aluno.Telefone, aluno.EmailProfissional, aluno.LinkedInUrl, aluno.GitHubUrl, aluno.PortfolioUrl),
            MapFile(aluno.FotoStorageKey),
            MapFile(aluno.CurriculoStorageKey),
            aluno.Competencias.OrderBy(x => x.Competencia.NomeBusca)
                .Select(x => new CompetenciaResponse(x.CompetenciaId, x.Competencia.Nome, x.Competencia.Categoria.Tipo())).ToList(),
            aluno.Idiomas.OrderBy(x => x.Idioma.NomeBusca)
                .Select(x => new AlunoIdiomaResponse(x.IdiomaId, x.Idioma.Nome, x.Nivel)).ToList(),
            aluno.Disponibilidades.OrderBy(x => x.Tipo).Select(x => x.Tipo).ToList(),
            aluno.Modalidades.OrderBy(x => x.Modalidade).Select(x => x.Modalidade).ToList(),
            BuscaMapping.Map(aluno, DateTimeOffset.UtcNow),
            aluno.Formacoes.OrderBy(x => x.CriadoEm).Select(TrajetoriaMapping.Map).ToList(),
            aluno.Experiencias.OrderByDescending(x => x.DataInicio).Select(TrajetoriaMapping.Map).ToList(),
            aluno.Projetos.OrderBy(x => x.Ordem).Select(TrajetoriaMapping.Map).ToList(),
            aluno.AtualizadoEm);
    }

    public async Task<ExportacaoRecrutadorResponse?> ExportRecrutadorAsync(Guid userId, CancellationToken cancellationToken)
    {
        var recrutador = await database.Recrutadores.AsNoTracking()
            .Include(x => x.User)
            .SingleOrDefaultAsync(x => x.UserId == userId, cancellationToken);
        if (recrutador is null) return null;

        var favoritedAt = await database.Favoritos.AsNoTracking()
            .Where(x => x.RecrutadorId == userId)
            .OrderBy(x => x.CriadoEm)
            .Select(x => x.CriadoEm)
            .ToListAsync(cancellationToken);

        return new(
            DateTimeOffset.UtcNow,
            MapAccount(recrutador.User),
            new(recrutador.ConsentimentoEm, recrutador.VersaoTermos, recrutador.NewsletterAceita, recrutador.NewsletterAtualizadaEm),
            recrutador.User.NomeCompleto,
            recrutador.Empresa,
            recrutador.Cargo,
            recrutador.Telefone,
            recrutador.Cidade,
            recrutador.Uf,
            recrutador.Status,
            new(favoritedAt.Count, favoritedAt));
    }

    private static ExportacaoConta MapAccount(ApplicationUser user) => new(user.Email, user.CriadoEm, user.UltimoLoginEm);

    // Storage keys look like "<32 hex>.<ext>"; only the extension is exported.
    private static ExportacaoArquivo MapFile(string? storageKey) =>
        string.IsNullOrEmpty(storageKey) ? new(false, null) : new(true, Path.GetExtension(storageKey).TrimStart('.'));
}
