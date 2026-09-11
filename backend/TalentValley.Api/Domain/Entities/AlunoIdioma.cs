using TalentValley.Api.Domain.Enums;

namespace TalentValley.Api.Domain.Entities;

public class AlunoIdioma
{
    public Guid AlunoId { get; set; }
    public Aluno Aluno { get; set; } = null!;
    public int IdiomaId { get; set; }
    public Idioma Idioma { get; set; } = null!;
    public NivelIdioma Nivel { get; set; }
}
