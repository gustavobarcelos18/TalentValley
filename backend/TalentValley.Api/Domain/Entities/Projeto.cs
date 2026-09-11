namespace TalentValley.Api.Domain.Entities;

public class Projeto
{
    public Guid Id { get; set; }
    public Guid AlunoId { get; set; }
    public Aluno Aluno { get; set; } = null!;
    public int Ordem { get; set; }
    public string Nome { get; set; } = string.Empty;
    public DateOnly DataInicio { get; set; }
    public DateOnly? DataFim { get; set; }
    public bool EmAndamento { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public string? DemoUrl { get; set; }
    public string? RepositorioUrl { get; set; }
    public DateTimeOffset CriadoEm { get; set; }
    public DateTimeOffset AtualizadoEm { get; set; }
    public ICollection<ProjetoCompetencia> Competencias { get; set; } = [];
}
