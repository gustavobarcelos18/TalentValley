using TalentValley.Api.Domain.Enums;

namespace TalentValley.Api.DTOs;

public sealed record RpvValidationListItem(
    Guid FormacaoId,
    Guid AlunoId,
    string AlunoNome,
    string AlunoSlug,
    bool AlunoAtivo,
    TipoFormacao Tipo,
    string Nome,
    string Instituicao,
    DateOnly DataInicio,
    DateOnly? DataFim,
    int? CargaHoraria,
    StatusFormacao Status,
    bool Principal,
    bool PossuiCertificado,
    DateTimeOffset AtualizadoEm);

public sealed record RpvValidationAlunoResponse(
    Guid Id,
    string NomeCompleto,
    string Slug,
    bool Ativo,
    string? Cidade,
    string? Uf);

public sealed record RpvValidationFormacaoResponse(
    TipoFormacao Tipo,
    string Nome,
    string Instituicao,
    DateOnly DataInicio,
    DateOnly? DataFim,
    int? CargaHoraria,
    StatusFormacao Status,
    bool Principal,
    bool EhRioPombaValley,
    StatusValidacaoRpv StatusValidacaoRpv,
    bool PossuiCertificado,
    DateTimeOffset AtualizadoEm);

public sealed record RpvValidationDetailResponse(
    Guid FormacaoId,
    RpvValidationAlunoResponse Aluno,
    RpvValidationFormacaoResponse Formacao);
