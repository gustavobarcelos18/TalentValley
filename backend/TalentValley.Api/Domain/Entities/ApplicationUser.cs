using Microsoft.AspNetCore.Identity;

namespace TalentValley.Api.Domain.Entities;

public class ApplicationUser : IdentityUser<Guid>
{
    public string NomeCompleto { get; set; } = string.Empty;
    public string NomeBusca { get; set; } = string.Empty;
    public DateTimeOffset CriadoEm { get; set; }
    public DateTimeOffset? UltimoLoginEm { get; set; }
    public DateTimeOffset? LoginAnteriorEm { get; set; }
    public DateTimeOffset? ExclusaoAgendadaEm { get; set; }
}
