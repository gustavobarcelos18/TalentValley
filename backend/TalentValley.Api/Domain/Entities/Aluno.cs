using TalentValley.Api.Domain.Enums;

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
    public string? LattesUrl { get; set; }
    public bool Ativo { get; set; }
    public DateTimeOffset AtualizadoEm { get; set; }
    // LGPD consent copied from the approved registration request.
    public DateTimeOffset? ConsentimentoEm { get; set; }
    public string? VersaoTermos { get; set; }
    // Optional newsletter consent: current choice and when it was last changed.
    public bool NewsletterAceita { get; set; }
    public DateTimeOffset? NewsletterAtualizadaEm { get; set; }
    // "O que eu busco": a null status means the student has not said yet. The confirmation date drives the 30-day warning.
    public StatusBusca? StatusBusca { get; set; }
    public DateTimeOffset? StatusBuscaConfirmadoEm { get; set; }
    public string? ObjetivoProfissional { get; set; }
    // Immediate availability and a start date are mutually exclusive; both empty means not informed.
    public bool DisponivelImediatamente { get; set; }
    public DateOnly? DisponivelAPartirDe { get; set; }
    public CargaHorariaSemanal? CargaHorariaSemanal { get; set; }
    public bool AceitaViajar { get; set; }
    public bool AceitaMudarDeCidade { get; set; }
    public bool PossuiVeiculoProprio { get; set; }
    // Sensitive data (LGPD art. 11): only kept together with the explicit consent timestamp.
    public bool SouPcd { get; set; }
    public bool InteresseVagaPcd { get; set; }
    public DateTimeOffset? ConsentimentoPcdEm { get; set; }
    public ICollection<AlunoCompetencia> Competencias { get; set; } = [];
    public ICollection<AlunoIdioma> Idiomas { get; set; } = [];
    public ICollection<Formacao> Formacoes { get; set; } = [];
    public ICollection<Experiencia> Experiencias { get; set; } = [];
    public ICollection<Projeto> Projetos { get; set; } = [];
    public ICollection<AlunoDisponibilidade> Disponibilidades { get; set; } = [];
    public ICollection<AlunoModalidade> Modalidades { get; set; } = [];
    public ICollection<AlunoAreaInteresse> AreasInteresse { get; set; } = [];
    public ICollection<AlunoCategoriaCnh> CategoriasCnh { get; set; } = [];
    public ICollection<AlunoTipoDeficiencia> TiposDeficiencia { get; set; } = [];
}
