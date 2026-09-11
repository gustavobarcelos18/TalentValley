using TalentValley.Api.Domain.Entities;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Services;

internal static class TrajetoriaMapping
{
    public static FormacaoResponse Map(Formacao x) => new(x.Id, x.Tipo, x.Nome, x.Instituicao,
        x.DataInicio, x.DataFim, x.CargaHoraria, x.Status, x.Principal, x.EhRioPombaValley,
        x.StatusValidacaoRpv, x.CertificadoStorageKey is not null, x.CriadoEm, x.AtualizadoEm);

    public static ExperienciaResponse Map(Experiencia x) => new(x.Id, x.Empresa, x.Cargo, x.Tipo,
        x.DataInicio, x.DataFim, x.Atual, x.Descricao, x.CriadoEm, x.AtualizadoEm);

    public static ProjetoResponse Map(Projeto x) => new(x.Id, x.Ordem, x.Nome, x.DataInicio,
        x.DataFim, x.EmAndamento, x.Descricao, x.DemoUrl, x.RepositorioUrl,
        x.Competencias.OrderBy(c => c.Competencia.NomeBusca).ThenBy(c => c.CompetenciaId)
            .Select(c => new CompetenciaResponse(c.CompetenciaId, c.Competencia.Nome)).ToList(),
        x.CriadoEm, x.AtualizadoEm);
}
