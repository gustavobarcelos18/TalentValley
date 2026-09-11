namespace TalentValley.Api.Domain.Entities;

public class Favorito
{
    public Guid RecrutadorId { get; set; }
    public Recrutador Recrutador { get; set; } = null!;
    public Guid AlunoId { get; set; }
    public Aluno Aluno { get; set; } = null!;
    public DateTimeOffset CriadoEm { get; set; }
}
