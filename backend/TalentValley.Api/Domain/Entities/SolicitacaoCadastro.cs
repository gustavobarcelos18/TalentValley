using TalentValley.Api.Domain.Enums;

namespace TalentValley.Api.Domain.Entities;

// This is deliberately separate from Identity. A request cannot authenticate.
public class SolicitacaoCadastro
{
    public Guid Id { get; set; }
    public TipoSolicitacaoCadastro Tipo { get; set; }
    public StatusSolicitacaoCadastro Status { get; set; }
    public string NomeCompleto { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string EmailNormalizado { get; set; } = string.Empty;
    public string Telefone { get; set; } = string.Empty;
    public string Cidade { get; set; } = string.Empty;
    public string Uf { get; set; } = string.Empty;
    public string? InstituicaoEnsino { get; set; }
    public string? Curso { get; set; }
    public TipoFormacao? TipoFormacao { get; set; }
    public int? AnoConclusaoPrevisto { get; set; }
    public string? RelacaoRioPombaValley { get; set; }
    public string? Empresa { get; set; }
    public string? Cargo { get; set; }
    public string? SiteEmpresa { get; set; }
    public DateTimeOffset CriadoEm { get; set; }
    public DateTimeOffset? AnalisadoEm { get; set; }
    public Guid? AdminUserId { get; set; }
    public ApplicationUser? AdminUser { get; set; }
    public string? MotivoRejeicao { get; set; }
}


