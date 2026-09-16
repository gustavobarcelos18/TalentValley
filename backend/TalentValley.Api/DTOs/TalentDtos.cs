using System.ComponentModel.DataAnnotations;
using TalentValley.Api.Domain.Enums;

namespace TalentValley.Api.DTOs;

public enum TalentSort
{
    RELEVANCIA,
    RECENTES,
    NOME
}

public sealed class TalentSearchQuery : IValidatableObject
{
    [Range(1, int.MaxValue / 10)]
    public int Page { get; init; } = 1;
    public string? Nome { get; init; }
    public string? Cidade { get; init; }
    public string? Uf { get; init; }
    public int[] CompetenciaIds { get; init; } = [];
    public TipoFormacao[] TiposFormacao { get; init; } = [];
    public string? FormacaoNome { get; init; }
    public StatusFormacao[] StatusFormacao { get; init; } = [];
    public bool? RpvVerificado { get; init; }
    public TipoDisponibilidade[] Disponibilidades { get; init; } = [];
    public ModalidadeTrabalho[] Modalidades { get; init; } = [];
    public TalentSort? Ordenacao { get; init; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        var uf = Uf?.Trim();
        if (!string.IsNullOrEmpty(uf) && (uf.Length != 2 || !uf.All(char.IsAsciiLetter)))
            yield return new ValidationResult("UF must contain exactly two alphabetic characters.", [nameof(Uf)]);
        if (Ordenacao is not null && !Enum.IsDefined(Ordenacao.Value))
            yield return new ValidationResult("Invalid sort value.", [nameof(Ordenacao)]);
        if (TiposFormacao.Any(x => !Enum.IsDefined(x)))
            yield return new ValidationResult("Invalid formation type.", [nameof(TiposFormacao)]);
        if (StatusFormacao.Any(x => !Enum.IsDefined(x)))
            yield return new ValidationResult("Invalid formation status.", [nameof(StatusFormacao)]);
        if (Disponibilidades.Any(x => !Enum.IsDefined(x)))
            yield return new ValidationResult("Invalid availability.", [nameof(Disponibilidades)]);
        if (Modalidades.Any(x => !Enum.IsDefined(x)))
            yield return new ValidationResult("Invalid modality.", [nameof(Modalidades)]);
    }
}

public sealed record TalentCompetencyResponse(int Id, string Nome);
public sealed record TalentFormationPreview(TipoFormacao Tipo, string Nome, string Instituicao, bool RpvVerificado);

public sealed record TalentListItem(
    Guid Id,
    string Slug,
    string NomeCompleto,
    string? FotoUrl,
    string? Cidade,
    string? Uf,
    string? Bio,
    IReadOnlyCollection<TalentCompetencyResponse> Competencias,
    TalentFormationPreview? FormacaoPrincipal,
    IReadOnlyCollection<TipoDisponibilidade> Disponibilidades,
    IReadOnlyCollection<ModalidadeTrabalho> Modalidades,
    bool Favorito,
    DateTimeOffset AtualizadoEm);

public sealed record TalentContactResponse(
    string? Telefone,
    string? EmailProfissional,
    string? LinkedInUrl,
    string? GitHubUrl,
    string? PortfolioUrl);

public sealed record TalentLanguageResponse(int IdiomaId, string Nome, NivelIdioma Nivel);

public sealed record TalentFormationResponse(
    Guid Id,
    TipoFormacao Tipo,
    string Nome,
    string Instituicao,
    DateOnly DataInicio,
    DateOnly? DataFim,
    int? CargaHoraria,
    StatusFormacao Status,
    bool Principal,
    bool RpvVerificado,
    bool PossuiCertificado,
    string? CertificadoUrl);

public sealed record TalentExperienceResponse(
    Guid Id,
    string Empresa,
    string Cargo,
    TipoExperiencia Tipo,
    DateOnly DataInicio,
    DateOnly? DataFim,
    bool Atual,
    string? Descricao);

public sealed record TalentProjectResponse(
    Guid Id,
    int Ordem,
    string Nome,
    DateOnly DataInicio,
    DateOnly? DataFim,
    bool EmAndamento,
    string Descricao,
    string? DemoUrl,
    string? RepositorioUrl,
    IReadOnlyCollection<TalentCompetencyResponse> Tecnologias);

public sealed record TalentCurriculumResponse(bool PossuiCurriculo, string? Url);

public sealed record TalentProfileResponse(
    Guid Id,
    string Slug,
    string NomeCompleto,
    string? FotoUrl,
    string? Cidade,
    string? Uf,
    TalentContactResponse Contato,
    string? Bio,
    IReadOnlyCollection<TalentCompetencyResponse> Competencias,
    IReadOnlyCollection<TalentLanguageResponse> Idiomas,
    IReadOnlyCollection<TipoDisponibilidade> Disponibilidades,
    IReadOnlyCollection<ModalidadeTrabalho> Modalidades,
    IReadOnlyCollection<TalentFormationResponse> Formacoes,
    IReadOnlyCollection<TalentExperienceResponse> Experiencias,
    IReadOnlyCollection<TalentProjectResponse> Projetos,
    TalentCurriculumResponse Curriculo,
    bool Favorito,
    DateTimeOffset AtualizadoEm);

public sealed record FavoriteTalentResponse(DateTimeOffset FavoritadoEm, TalentListItem Talento);

public sealed record TalentCommonResponse(
    IReadOnlyCollection<TalentCompetencyResponse> Competencias,
    IReadOnlyCollection<TipoDisponibilidade> Disponibilidades,
    IReadOnlyCollection<ModalidadeTrabalho> Modalidades);

public sealed record TalentComparisonResponse(
    TalentProfileResponse TalentoA,
    TalentCommonResponse EmComum,
    TalentProfileResponse TalentoB);

public sealed record RecruiterDashboardIndicatorsResponse(
    int PerfisAtualizadosDesdeUltimoAcesso,
    int NovosAlunosDesdeUltimoAcesso,
    int Favoritos);

public sealed record RecruiterDashboardResponse(
    DateTimeOffset? DesdeUltimoAcesso,
    RecruiterDashboardIndicatorsResponse Indicadores,
    IReadOnlyCollection<FavoriteTalentResponse> FavoritosRecentes);

public sealed class FavoriteListQuery
{
    [Range(1, int.MaxValue / 10)]
    public int Page { get; init; } = 1;
}
