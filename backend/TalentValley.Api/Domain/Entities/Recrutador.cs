using TalentValley.Api.Domain.Enums;

namespace TalentValley.Api.Domain.Entities;

public class Recrutador
{
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public string Empresa { get; set; } = string.Empty;
    public string EmpresaBusca { get; set; } = string.Empty;
    public string Cargo { get; set; } = string.Empty;
    public string Telefone { get; set; } = string.Empty;
    public string Cidade { get; set; } = string.Empty;
    public string Uf { get; set; } = string.Empty;
    public StatusRecrutador Status { get; set; }
}
