namespace TalentValley.Api.Domain.Entities;

public class Aluno
{
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public string Slug { get; set; } = string.Empty;
    public string? FotoStorageKey { get; set; }
    public string? Cidade { get; set; }
    public string? Uf { get; set; }
    public string? Telefone { get; set; }
    public string? EmailProfissional { get; set; }
    public string? LinkedInUrl { get; set; }
    public string? GitHubUrl { get; set; }
    public string? PortfolioUrl { get; set; }
    public string? Bio { get; set; }
    public string? CurriculoStorageKey { get; set; }
    public bool Ativo { get; set; }
    public DateTimeOffset AtualizadoEm { get; set; }
    public ICollection<AlunoCompetencia> Competencias { get; set; } = [];
    public ICollection<AlunoIdioma> Idiomas { get; set; } = [];
    public ICollection<Formacao> Formacoes { get; set; } = [];
    public ICollection<Experiencia> Experiencias { get; set; } = [];
    public ICollection<Projeto> Projetos { get; set; } = [];
    public ICollection<AlunoDisponibilidade> Disponibilidades { get; set; } = [];
    public ICollection<AlunoModalidade> Modalidades { get; set; } = [];
}
