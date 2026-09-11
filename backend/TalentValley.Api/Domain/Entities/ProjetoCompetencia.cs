namespace TalentValley.Api.Domain.Entities;

public class ProjetoCompetencia
{
    public Guid ProjetoId { get; set; }
    public Projeto Projeto { get; set; } = null!;
    public int CompetenciaId { get; set; }
    public Competencia Competencia { get; set; } = null!;
}
