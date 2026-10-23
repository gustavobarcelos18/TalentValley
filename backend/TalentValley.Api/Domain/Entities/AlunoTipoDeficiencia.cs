using TalentValley.Api.Domain.Enums;

namespace TalentValley.Api.Domain.Entities;

public class AlunoTipoDeficiencia
{
    public Guid AlunoId { get; set; }
    public Aluno Aluno { get; set; } = null!;
    public TipoDeficiencia Tipo { get; set; }
}
