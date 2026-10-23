using TalentValley.Api.Domain.Enums;

namespace TalentValley.Api.Domain.Entities;

public class AlunoCategoriaCnh
{
    public Guid AlunoId { get; set; }
    public Aluno Aluno { get; set; } = null!;
    public CategoriaCnh Categoria { get; set; }
}
