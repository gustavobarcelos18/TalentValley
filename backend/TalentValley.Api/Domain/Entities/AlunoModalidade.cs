using TalentValley.Api.Domain.Enums;

namespace TalentValley.Api.Domain.Entities;

public class AlunoModalidade
{
    public Guid AlunoId { get; set; }
    public Aluno Aluno { get; set; } = null!;
    public ModalidadeTrabalho Modalidade { get; set; }
}
