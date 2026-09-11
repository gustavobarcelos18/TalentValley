using TalentValley.Api.Domain.Enums;

namespace TalentValley.Api.Domain.Entities;

public class AlunoDisponibilidade
{
    public Guid AlunoId { get; set; }
    public Aluno Aluno { get; set; } = null!;
    public TipoDisponibilidade Tipo { get; set; }
}
