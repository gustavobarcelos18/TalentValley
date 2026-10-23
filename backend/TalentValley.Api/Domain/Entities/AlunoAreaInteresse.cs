using TalentValley.Api.Domain.Enums;

namespace TalentValley.Api.Domain.Entities;

public class AlunoAreaInteresse
{
    public Guid AlunoId { get; set; }
    public Aluno Aluno { get; set; } = null!;
    public AreaInteresse Area { get; set; }
}
