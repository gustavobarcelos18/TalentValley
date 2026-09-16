using System.ComponentModel.DataAnnotations;
using TalentValley.Api.Domain.Enums;

namespace TalentValley.Api.DTOs;

public abstract class SolicitarCadastroBaseRequest
{
    private string nomeCompleto = string.Empty, email = string.Empty, telefone = string.Empty, cidade = string.Empty, uf = string.Empty;
    [Required, StringLength(150, MinimumLength = 3), PersonName, NoEmoji] public string NomeCompleto { get => nomeCompleto; init => nomeCompleto = Normalize(value); }
    [Required, EmailAddress, SafeEmail, StringLength(254), NoEmoji] public string Email { get => email; init => email = value?.Trim() ?? string.Empty; }
    [Required, StringLength(20), BrazilianPhone] public string Telefone { get => telefone; init => telefone = value?.Trim() ?? string.Empty; }
    [Required, StringLength(120, MinimumLength = 2), CityName, NoEmoji] public string Cidade { get => cidade; init => cidade = Normalize(value); }
    [Required, BrazilianUf] public string Uf { get => uf; init => uf = value?.Trim().ToUpperInvariant() ?? string.Empty; }
    private static string Normalize(string? value) => string.Join(' ', (value ?? string.Empty).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
}

public sealed class SolicitarCadastroAlunoRequest : SolicitarCadastroBaseRequest
{
    private string instituicao = string.Empty, curso = string.Empty, relacao = string.Empty;
    [Required, StringLength(180, MinimumLength = 2), MeaningfulText, NoEmoji] public string InstituicaoEnsino { get => instituicao; init => instituicao = value?.Trim() ?? string.Empty; }
    [Required, StringLength(180, MinimumLength = 2), MeaningfulText, NoEmoji] public string Curso { get => curso; init => curso = value?.Trim() ?? string.Empty; }
    [Required, EnumDataType(typeof(TipoFormacao))] public TipoFormacao? TipoFormacao { get; init; }
    [YearRange] public int? AnoConclusaoPrevisto { get; init; }
    [StringLength(500), NoEmoji, NoControlCharacters] public string? RelacaoRioPombaValley { get => string.IsNullOrWhiteSpace(relacao) ? null : relacao; init => relacao = value?.Trim() ?? string.Empty; }
}

public sealed class SolicitarCadastroRecrutadorRequest : SolicitarCadastroBaseRequest
{
    private string empresa = string.Empty, cargo = string.Empty, site = string.Empty;
    [Required, StringLength(150, MinimumLength = 2), MeaningfulText, NoEmoji] public string Empresa { get => empresa; init => empresa = value?.Trim() ?? string.Empty; }
    [Required, StringLength(120, MinimumLength = 2), MeaningfulText, NoEmoji] public string Cargo { get => cargo; init => cargo = value?.Trim() ?? string.Empty; }
    [StringLength(2048), SafeHttpUrl, NoEmoji] public string? SiteEmpresa { get => string.IsNullOrWhiteSpace(site) ? null : site; init => site = value?.Trim() ?? string.Empty; }
}

public sealed record SolicitacaoCadastroCreatedResponse(Guid Id, StatusSolicitacaoCadastro Status);

public sealed class SolicitacaoCadastroListQuery
{
    [Range(1, int.MaxValue / 10)] public int Page { get; init; } = 1;
    [StringLength(150), NoEmoji] public string? Search { get; init; }
    [RegularExpression("^(ALUNO|RECRUTADOR)$")] public string? Tipo { get; init; }
    [RegularExpression("^(PENDENTE|APROVADA|REJEITADA)$")] public string? Status { get; init; }
}

public sealed class RejeitarSolicitacaoCadastroRequest
{
    private string motivo = string.Empty;
    [StringLength(500), NoEmoji, NoControlCharacters] public string? Motivo { get => string.IsNullOrWhiteSpace(motivo) ? null : motivo; init => motivo = value?.Trim() ?? string.Empty; }
}

public sealed record SolicitacaoCadastroListItem(Guid Id, TipoSolicitacaoCadastro Tipo, StatusSolicitacaoCadastro Status,
    string NomeCompleto, string Email, string Telefone, string Cidade, string Uf, string? InstituicaoEnsino, string? Curso,
    TipoFormacao? TipoFormacao, int? AnoConclusaoPrevisto, string? Empresa, string? Cargo, DateTimeOffset CriadoEm);
public sealed record SolicitacaoCadastroDetailResponse(Guid Id, TipoSolicitacaoCadastro Tipo, StatusSolicitacaoCadastro Status,
    string NomeCompleto, string Email, string Telefone, string Cidade, string Uf, string? InstituicaoEnsino, string? Curso,
    TipoFormacao? TipoFormacao, int? AnoConclusaoPrevisto, string? RelacaoRioPombaValley, string? Empresa, string? Cargo,
    string? SiteEmpresa, DateTimeOffset CriadoEm, DateTimeOffset? AnalisadoEm, string? AdminEmail, string? MotivoRejeicao);
