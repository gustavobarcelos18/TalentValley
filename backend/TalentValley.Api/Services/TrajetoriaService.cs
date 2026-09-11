using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Services;

public sealed class TrajetoriaService(FormacaoService formacoes, ExperienciaService experiencias)
{
    public async Task<IReadOnlyCollection<TrajetoriaItemResponse>> ListAsync(Guid alunoId)
    {
        var education = (await formacoes.ListAsync(alunoId)).Select(x => new TrajetoriaItemResponse(
            TipoItemTrajetoria.FORMACAO, x.Id, x.Nome, x.Instituicao, x.DataInicio, x.DataFim,
            x.Status == StatusFormacao.EM_ANDAMENTO, x, null));
        var experience = (await experiencias.ListAsync(alunoId)).Select(x => new TrajetoriaItemResponse(
            TipoItemTrajetoria.EXPERIENCIA, x.Id, x.Cargo, x.Empresa, x.DataInicio, x.DataFim, x.Atual, null, x));
        // Current first, start date descending, kind (formation first), then stable ID ascending.
        return education.Concat(experience).OrderByDescending(x => x.Atual).ThenByDescending(x => x.DataInicio)
            .ThenBy(x => x.TipoItem).ThenBy(x => x.Id).ToList();
    }
}
