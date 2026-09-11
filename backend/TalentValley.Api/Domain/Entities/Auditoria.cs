using TalentValley.Api.Domain.Enums;

namespace TalentValley.Api.Domain.Entities;

public class Auditoria
{
    public Guid Id { get; set; }
    public Guid? AdminUserId { get; set; }
    public ApplicationUser? AdminUser { get; set; }
    public string AdminEmailSnapshot { get; set; } = string.Empty;
    public AcaoAuditoria Acao { get; set; }
    public string EntidadeTipo { get; set; } = string.Empty;
    public string EntidadeId { get; set; } = string.Empty;
    public string Descricao { get; set; } = string.Empty;
    public DateTimeOffset CriadoEm { get; set; }
}
