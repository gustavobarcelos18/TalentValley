using System.ComponentModel.DataAnnotations;
using TalentValley.Api.Domain.Enums;

namespace TalentValley.Api.DTOs;

public sealed class CreateAlunoRequest
{
    private string nomeCompleto = string.Empty;
    private string email = string.Empty;
    [Required, StringLength(150, MinimumLength = 3)]
    public string NomeCompleto { get => nomeCompleto; init => nomeCompleto = value?.Trim() ?? string.Empty; }
    [Required, EmailAddress, StringLength(254)]
    public string Email { get => email; init => email = value?.Trim() ?? string.Empty; }
}

public sealed class CreateRecrutadorRequest
{
    private string nomeCompleto = string.Empty, email = string.Empty, empresa = string.Empty,
        cargo = string.Empty, telefone = string.Empty, cidade = string.Empty, uf = string.Empty;
    [Required, StringLength(150, MinimumLength = 3)]
    public string NomeCompleto { get => nomeCompleto; init => nomeCompleto = value?.Trim() ?? string.Empty; }
    [Required, EmailAddress, StringLength(254)]
    public string Email { get => email; init => email = value?.Trim() ?? string.Empty; }
    [Required, StringLength(150, MinimumLength = 2)]
    public string Empresa { get => empresa; init => empresa = value?.Trim() ?? string.Empty; }
    [Required, StringLength(120, MinimumLength = 2)]
    public string Cargo { get => cargo; init => cargo = value?.Trim() ?? string.Empty; }
    [Required, StringLength(20)]
    public string Telefone { get => telefone; init => telefone = value?.Trim() ?? string.Empty; }
    [Required, StringLength(120, MinimumLength = 2)]
    public string Cidade { get => cidade; init => cidade = value?.Trim() ?? string.Empty; }
    [Required, RegularExpression("^[A-Z]{2}$")]
    public string Uf { get => uf; init => uf = value?.Trim().ToUpperInvariant() ?? string.Empty; }
}

public sealed class AdminListQuery
{
    // Bound the offset to avoid integer overflow, including audit's page size of 20.
    [Range(1, int.MaxValue / 20)] public int Page { get; init; } = 1;
    [StringLength(150)] public string? Search { get; init; }
}

public sealed class RecrutadorListQuery
{
    [Range(1, int.MaxValue / 20)] public int Page { get; init; } = 1;
    [StringLength(150)] public string? Search { get; init; }
    [RegularExpression("^(ATIVO|BLOQUEADO)$")] public string? Status { get; init; }
}

public sealed record PaginatedResponse<T>(IReadOnlyCollection<T> Items, int Page, int PageSize, int TotalItems, int TotalPages);
public sealed record AlunoCreatedResponse(Guid Id, string NomeCompleto, string Email, bool Ativo);
public sealed record AlunoListItem(Guid Id, string Slug, string NomeCompleto, string? FotoUrl,
    string? Cidade, string? Uf, bool Ativo, DateTimeOffset AtualizadoEm);
public sealed record RecrutadorCreatedResponse(Guid Id, string NomeCompleto, string Email, StatusRecrutador Status);
public sealed record RecrutadorListItem(Guid Id, string NomeCompleto, string Empresa, string Cargo,
    string Cidade, string Uf, StatusRecrutador Status, DateTimeOffset? UltimoAcessoEm);
public sealed record RecrutadorDetailResponse(Guid Id, string NomeCompleto, string Email, string Empresa,
    string Cargo, string Telefone, string Cidade, string Uf, StatusRecrutador Status, DateTimeOffset? UltimoAcessoEm);
public sealed record AuditoriaListItem(Guid Id, AcaoAuditoria Acao, string AdminEmail, string EntidadeTipo,
    string EntidadeId, string Descricao, DateTimeOffset CriadoEm);
