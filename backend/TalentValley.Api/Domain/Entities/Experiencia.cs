using TalentValley.Api.Domain.Enums;

namespace TalentValley.Api.Domain.Entities;

public class Experiencia
{
    public Guid Id { get; set; }
    public Guid AlunoId { get; set; }
    public Aluno Aluno { get; set; } = null!;
    public string Empresa { get; set; } = string.Empty;
    public string Cargo { get; set; } = string.Empty;
    public TipoExperiencia Tipo { get; set; }
    public DateOnly DataInicio { get; set; }
    public DateOnly? DataFim { get; set; }
    public bool Atual { get; set; }
    public string? Descricao { get; set; }
    public DateTimeOffset CriadoEm { get; set; }
    public DateTimeOffset AtualizadoEm { get; set; }
}
