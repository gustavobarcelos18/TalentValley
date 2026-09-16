using System.ComponentModel.DataAnnotations;
using TalentValley.Api.Domain.Enums;

namespace TalentValley.Api.DTOs;

// GET /api/alunos/me response
public sealed record MeResponse(
    Guid Id,
    string Slug,
    DadosBasicosResponse DadosBasicos,
    SobreResponse Sobre,
    ContatoResponse Contato,
    IReadOnlyCollection<CompetenciaResponse> Competencias,
    IReadOnlyCollection<AlunoIdiomaResponse> Idiomas,
    IReadOnlyCollection<TipoDisponibilidade> Disponibilidades,
    IReadOnlyCollection<ModalidadeTrabalho> Modalidades,
    IReadOnlyCollection<FormacaoResponse> Formacoes,
    IReadOnlyCollection<ExperienciaResponse> Experiencias,
    IReadOnlyCollection<ProjetoResponse> Projetos,
    CurriculoResponse Curriculo,
    DateTimeOffset AtualizadoEm);

public sealed record DadosBasicosResponse(string NomeCompleto, string? FotoUrl, string? Cidade, string? Uf);
public sealed record SobreResponse(string? Bio);
public sealed record ContatoResponse(string? Telefone, string? EmailProfissional, string? LinkedInUrl, string? GitHubUrl, string? PortfolioUrl);
public sealed record CurriculoResponse(bool PossuiCurriculo, string? NomeArquivo);

public sealed record CompetenciaResponse(int Id, string Nome);
public sealed record AlunoIdiomaResponse(int IdiomaId, string Nome, NivelIdioma Nivel);

// Catalog responses
public sealed record CatalogoCompetenciaResponse(int Id, string Nome);
public sealed record CatalogoIdiomaResponse(int Id, string Nome);

// Update requests
public sealed class UpdateDadosBasicosRequest
{
    private string nomeCompleto = string.Empty;
    private string cidade = string.Empty;
    private string? uf = null;
    [Required, StringLength(150, MinimumLength = 3), PersonName, NoEmoji]
    public string NomeCompleto { get => nomeCompleto; init => nomeCompleto = Normalize(value); }
    [Required, StringLength(120, MinimumLength = 2), CityName, NoEmoji]
    public string Cidade { get => cidade; init => cidade = Normalize(value); }
    [Required, BrazilianUf]
    public string? Uf { get => uf; init => uf = string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToUpperInvariant(); }
    private static string Normalize(string? value) => string.Join(' ', (value ?? string.Empty).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
}

public sealed class UpdateSobreRequest
{
    private string? bio = null;
    [StringLength(1500), NoEmoji, NoControlCharacters]
    public string? Bio { get => bio; init => bio = string.IsNullOrWhiteSpace(value) ? null : value.Trim(); }
}

public sealed class UpdateContatoRequest
{
    private string? telefone, emailProfissional, linkedinUrl, githubUrl, portfolioUrl;
    [StringLength(20), BrazilianPhone]
    public string? Telefone { get => telefone; init => telefone = string.IsNullOrWhiteSpace(value) ? null : value.Trim(); }
    [EmailAddress, SafeEmail, StringLength(254), NoEmoji]
    public string? EmailProfissional { get => emailProfissional; init => emailProfissional = string.IsNullOrWhiteSpace(value) ? null : value.Trim(); }
    [StringLength(2048), SafeHttpUrl, NoEmoji]
    public string? LinkedInUrl { get => linkedinUrl; init => linkedinUrl = string.IsNullOrWhiteSpace(value) ? null : value.Trim(); }
    [StringLength(2048), SafeHttpUrl, NoEmoji]
    public string? GitHubUrl { get => githubUrl; init => githubUrl = string.IsNullOrWhiteSpace(value) ? null : value.Trim(); }
    [StringLength(2048), SafeHttpUrl, NoEmoji]
    public string? PortfolioUrl { get => portfolioUrl; init => portfolioUrl = string.IsNullOrWhiteSpace(value) ? null : value.Trim(); }
}

public sealed record UpdateCompetenciasRequest(IReadOnlyCollection<int> CompetenciaIds);

public sealed record ItemIdiomaRequest(int IdiomaId, NivelIdioma Nivel);
public sealed record UpdateIdiomasRequest(IReadOnlyCollection<ItemIdiomaRequest> Idiomas);

public sealed record UpdateDisponibilidadeRequest(
    IReadOnlyCollection<TipoDisponibilidade> Disponibilidades,
    IReadOnlyCollection<ModalidadeTrabalho> Modalidades);
