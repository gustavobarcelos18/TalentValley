using TalentValley.Api.Domain.Enums;

namespace TalentValley.Api.Domain.Entities;

public class Formacao
{
    public Guid Id { get; set; }
    public Guid AlunoId { get; set; }
    public Aluno Aluno { get; set; } = null!;
    public TipoFormacao Tipo { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string NomeBusca { get; set; } = string.Empty;
    public string Instituicao { get; set; } = string.Empty;
    public DateOnly DataInicio { get; set; }
    public DateOnly? DataFim { get; set; }
    public int? CargaHoraria { get; set; }
    public StatusFormacao Status { get; set; }
    public bool Principal { get; set; }
    public bool EhRioPombaValley { get; set; }
    public StatusValidacaoRpv? StatusValidacaoRpv { get; set; }
    public string? CertificadoStorageKey { get; set; }
    public DateTimeOffset CriadoEm { get; set; }
    public DateTimeOffset AtualizadoEm { get; set; }
    public DateTimeOffset? ValidadoEm { get; set; }
}
