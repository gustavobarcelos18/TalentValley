using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using TalentValley.Api.Domain.Enums;

namespace TalentValley.Api.DTOs;

// DELETE /api/alunos/me request (LGPD self-deletion confirmation)
public sealed record DeleteOwnProfileRequest([Required, StringLength(1024)] string SenhaAtual);

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
    BuscaResponse Busca,
    IReadOnlyCollection<FormacaoResponse> Formacoes,
    IReadOnlyCollection<ExperienciaResponse> Experiencias,
    IReadOnlyCollection<ProjetoResponse> Projetos,
    CurriculoResponse Curriculo,
    DateTimeOffset AtualizadoEm);

public sealed record DadosBasicosResponse(string NomeCompleto, string? FotoUrl, string? Cidade, string? Uf);
public sealed record SobreResponse(string? Bio);
public sealed record ContatoResponse(string? Telefone, string? EmailProfissional, string? LinkedInUrl, string? GitHubUrl, string? PortfolioUrl);
public sealed record CurriculoResponse(bool PossuiCurriculo, string? NomeArquivo);

// "O que eu busco". StatusDesatualizado is computed by the backend (status not confirmed for over 30 days).
public sealed record BuscaResponse(
    StatusBusca? Status,
    DateTimeOffset? StatusConfirmadoEm,
    bool StatusDesatualizado,
    string? Objetivo,
    IReadOnlyCollection<AreaInteresse> AreasInteresse,
    bool DisponivelImediatamente,
    DateOnly? DisponivelAPartirDe,
    CargaHorariaSemanal? CargaHoraria,
    bool AceitaViajar,
    bool AceitaMudarDeCidade,
    IReadOnlyCollection<CategoriaCnh> CategoriasCnh,
    bool PossuiVeiculoProprio,
    PcdResponse Pcd);

public sealed record PcdResponse(
    bool SouPcd,
    bool InteresseVagaPcd,
    IReadOnlyCollection<TipoDeficiencia> Tipos,
    DateTimeOffset? ConsentimentoEm);

public sealed record CompetenciaResponse(int Id, string Nome, TipoCompetencia Tipo);
public sealed record AlunoIdiomaResponse(int IdiomaId, string Nome, NivelIdioma Nivel);

// Catalog responses
public sealed record CatalogoCompetenciaResponse(int Id, string Nome, string Categoria, TipoCompetencia Tipo);
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
    [StringLength(1500, ErrorMessage = "O texto deve ter no máximo 1500 caracteres."), NoEmoji, NoControlCharacters(AllowLineBreaks = true)]
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

// PUT /api/alunos/me/disponibilidade: the whole "O que eu busco" form, always a full replacement.
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class UpdateDisponibilidadeRequest : IValidatableObject
{
    public const int MaxAreasInteresse = 5;

    private string? objetivoProfissional;
    public IReadOnlyCollection<TipoDisponibilidade> Disponibilidades { get; init; } = null!;
    public IReadOnlyCollection<ModalidadeTrabalho> Modalidades { get; init; } = null!;
    [EnumDataType(typeof(StatusBusca))] public StatusBusca? StatusBusca { get; init; }
    [StringLength(280, ErrorMessage = "O texto deve ter no máximo 280 caracteres."), NoEmoji, NoControlCharacters]
    public string? ObjetivoProfissional { get => objetivoProfissional; init => objetivoProfissional = string.IsNullOrWhiteSpace(value) ? null : value.Trim(); }
    public IReadOnlyCollection<AreaInteresse> AreasInteresse { get; init; } = [];
    [JsonRequired] public bool DisponivelImediatamente { get; init; }
    [DateYearRange] public DateOnly? DisponivelAPartirDe { get; init; }
    [EnumDataType(typeof(CargaHorariaSemanal))] public CargaHorariaSemanal? CargaHorariaSemanal { get; init; }
    [JsonRequired] public bool AceitaViajar { get; init; }
    [JsonRequired] public bool AceitaMudarDeCidade { get; init; }
    public IReadOnlyCollection<CategoriaCnh> CategoriasCnh { get; init; } = [];
    [JsonRequired] public bool PossuiVeiculoProprio { get; init; }
    [JsonRequired] public bool SouPcd { get; init; }
    [JsonRequired] public bool InteresseVagaPcd { get; init; }
    public IReadOnlyCollection<TipoDeficiencia> TiposDeficiencia { get; init; } = [];
    [JsonRequired] public bool ConsentimentoPcd { get; init; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (AreasInteresse.Count > MaxAreasInteresse)
            yield return new($"Escolha no máximo {MaxAreasInteresse} áreas de interesse.", [nameof(AreasInteresse)]);
        foreach (var problem in CheckDefined(nameof(Disponibilidades), "Tipos de vaga", Disponibilidades)
                     .Concat(CheckDefined(nameof(Modalidades), "Modalidades", Modalidades))
                     .Concat(CheckSet(nameof(AreasInteresse), "Áreas de interesse", AreasInteresse))
                     .Concat(CheckSet(nameof(CategoriasCnh), "Categorias de CNH", CategoriasCnh))
                     .Concat(CheckSet(nameof(TiposDeficiencia), "Tipos de deficiência", TiposDeficiencia)))
            yield return problem;
        if (DisponivelImediatamente && DisponivelAPartirDe is not null)
            yield return new("Informe disponibilidade imediata ou uma data de início, não os dois.", [nameof(DisponivelAPartirDe)]);
        if ((SouPcd || InteresseVagaPcd) && !ConsentimentoPcd)
            yield return new("Marque a autorização para compartilhar a informação PCD com recrutadores.", [nameof(ConsentimentoPcd)]);
    }

    // The JSON enum converter accepts comma-joined names ("D, E") and builds a value that is not in the enum,
    // so every item is checked against the defined values as well as for repeats.
    private static IEnumerable<ValidationResult> CheckDefined<T>(string member, string label, IReadOnlyCollection<T> values)
        where T : struct, Enum
    {
        if (values.Any(x => !Enum.IsDefined(x)))
            yield return new($"{label}: valor inválido.", [member]);
    }

    private static IEnumerable<ValidationResult> CheckSet<T>(string member, string label, IReadOnlyCollection<T> values)
        where T : struct, Enum
    {
        foreach (var problem in CheckDefined(member, label, values))
            yield return problem;
        if (values.Distinct().Count() != values.Count)
            yield return new($"{label}: há itens repetidos.", [member]);
    }
}
