namespace TalentValley.Api.Domain.Entities;

public class AlunoCompetencia
{
    public Guid AlunoId { get; set; }
    public Aluno Aluno { get; set; } = null!;
    public int CompetenciaId { get; set; }
    public Competencia Competencia { get; set; } = null!;
}
