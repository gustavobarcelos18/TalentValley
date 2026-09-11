namespace TalentValley.Api.Domain.Entities;

public class Idioma
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string NomeBusca { get; set; } = string.Empty;
    public ICollection<AlunoIdioma> Alunos { get; set; } = [];
}
