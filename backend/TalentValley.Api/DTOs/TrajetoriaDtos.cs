using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using TalentValley.Api.Domain.Enums;

namespace TalentValley.Api.DTOs;

// Reject extra fields, including AlunoId, validation state, and storage keys.
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class FormacaoRequest : IValidatableObject
{
    private string nome = string.Empty, instituicao = string.Empty;
    [Required, EnumDataType(typeof(TipoFormacao))] public TipoFormacao? Tipo { get; init; }
    [Required, StringLength(200), MeaningfulText, NoEmoji]
    public string Nome { get => nome; init => nome = value?.Trim() ?? string.Empty; }
    [Required, StringLength(200), MeaningfulText, NoEmoji]
    public string Instituicao { get => instituicao; init => instituicao = value?.Trim() ?? string.Empty; }
    [Required] public DateOnly? DataInicio { get; init; }
    public DateOnly? DataFim { get; init; }
    [Range(1, int.MaxValue)] public int? CargaHoraria { get; init; }
    [Required, EnumDataType(typeof(StatusFormacao))] public StatusFormacao? Status { get; init; }
    public bool Principal { get; init; }
    public bool EhRioPombaValley { get; init; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (DataFim < DataInicio)
            yield return new("DataFim must not precede DataInicio.", [nameof(DataFim)]);
        if (Status == StatusFormacao.CONCLUIDO && DataFim is null)
            yield return new("Completed formations require DataFim.", [nameof(DataFim)]);
        if (Status == StatusFormacao.EM_ANDAMENTO && DataFim is not null)
            yield return new("Ongoing formations must not have DataFim.", [nameof(DataFim)]);
    }
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class ExperienciaRequest : IValidatableObject
{
    private string empresa = string.Empty, cargo = string.Empty;
    private string? descricao;
    [Required, StringLength(150), MeaningfulText, NoEmoji]
    public string Empresa { get => empresa; init => empresa = value?.Trim() ?? string.Empty; }
    [Required, StringLength(150), MeaningfulText, NoEmoji]
    public string Cargo { get => cargo; init => cargo = value?.Trim() ?? string.Empty; }
    [Required, EnumDataType(typeof(TipoExperiencia))] public TipoExperiencia? Tipo { get; init; }
    [Required] public DateOnly? DataInicio { get; init; }
    public DateOnly? DataFim { get; init; }
    public bool Atual { get; init; }
    [StringLength(2000), NoEmoji, NoControlCharacters]
    public string? Descricao { get => descricao; init => descricao = string.IsNullOrWhiteSpace(value) ? null : value.Trim(); }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (!Atual && DataFim < DataInicio)
            yield return new("DataFim must not precede DataInicio.", [nameof(DataFim)]);
        if (Atual && DataFim is not null)
            yield return new("Current experiences must not have DataFim.", [nameof(DataFim)]);
    }
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class ProjetoRequest : IValidatableObject
{
    private string nome = string.Empty, descricao = string.Empty;
    private string? demoUrl, repositorioUrl;
    [Range(1, 2)] public int Ordem { get; init; }
    [Required, StringLength(200), MeaningfulText, NoEmoji]
    public string Nome { get => nome; init => nome = value?.Trim() ?? string.Empty; }
    [Required] public DateOnly? DataInicio { get; init; }
    public DateOnly? DataFim { get; init; }
    public bool EmAndamento { get; init; }
    [Required, StringLength(1000), NoEmoji, NoControlCharacters]
    public string Descricao { get => descricao; init => descricao = value?.Trim() ?? string.Empty; }
    [StringLength(2048), SafeHttpUrl, NoEmoji]
    public string? DemoUrl { get => demoUrl; init => demoUrl = string.IsNullOrWhiteSpace(value) ? null : value.Trim(); }
    [StringLength(2048), SafeHttpUrl, NoEmoji]
    public string? RepositorioUrl { get => repositorioUrl; init => repositorioUrl = string.IsNullOrWhiteSpace(value) ? null : value.Trim(); }
    [Required] public IReadOnlyCollection<int> CompetenciaIds { get; init; } = [];

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (!EmAndamento && DataFim < DataInicio)
            yield return new("DataFim must not precede DataInicio.", [nameof(DataFim)]);
        if (EmAndamento && DataFim is not null)
            yield return new("Ongoing projects must not have DataFim.", [nameof(DataFim)]);
        if (CompetenciaIds is not null && CompetenciaIds.Distinct().Count() != CompetenciaIds.Count)
            yield return new("Duplicate competency IDs in request.", [nameof(CompetenciaIds)]);
    }
}

public sealed record FormacaoResponse(Guid Id, TipoFormacao Tipo, string Nome, string Instituicao,
    DateOnly DataInicio, DateOnly? DataFim, int? CargaHoraria, StatusFormacao Status, bool Principal,
    bool EhRioPombaValley, StatusValidacaoRpv? StatusValidacaoRpv, bool PossuiCertificado,
    DateTimeOffset CriadoEm, DateTimeOffset AtualizadoEm);
public sealed record ExperienciaResponse(Guid Id, string Empresa, string Cargo, TipoExperiencia Tipo,
    DateOnly DataInicio, DateOnly? DataFim, bool Atual, string? Descricao,
    DateTimeOffset CriadoEm, DateTimeOffset AtualizadoEm);
public sealed record ProjetoResponse(Guid Id, int Ordem, string Nome, DateOnly DataInicio, DateOnly? DataFim,
    bool EmAndamento, string Descricao, string? DemoUrl, string? RepositorioUrl,
    IReadOnlyCollection<CompetenciaResponse> Competencias, DateTimeOffset CriadoEm, DateTimeOffset AtualizadoEm);

public enum TipoItemTrajetoria { FORMACAO, EXPERIENCIA }
public sealed record TrajetoriaItemResponse(TipoItemTrajetoria TipoItem, Guid Id, string Titulo, string Subtitulo,
    DateOnly DataInicio, DateOnly? DataFim, bool Atual, FormacaoResponse? Formacao, ExperienciaResponse? Experiencia);
