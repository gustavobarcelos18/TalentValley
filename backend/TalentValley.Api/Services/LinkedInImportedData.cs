namespace TalentValley.Api.Services;

// Internal model for what was read from a LinkedIn export. It is not an API DTO.
// Dates and levels are kept exactly as LinkedIn wrote them; translating them to the domain is a later step.
public sealed record LinkedInImportedData(
    LinkedInContato Contato,
    string? Bio,
    IReadOnlyList<LinkedInExperiencia> Experiencias,
    IReadOnlyList<LinkedInFormacao> Formacoes,
    IReadOnlyList<LinkedInCertificacao> Certificacoes,
    IReadOnlyList<string> Competencias,
    IReadOnlyList<LinkedInIdioma> Idiomas,
    IReadOnlyList<LinkedInProjeto> Projetos);

public sealed record LinkedInContato(string? Localizacao, IReadOnlyList<LinkedInSite> Sites,
    IReadOnlyList<LinkedInEmail> Emails, IReadOnlyList<LinkedInTelefone> Telefones);

public sealed record LinkedInEmail(string Endereco, bool Primario);

public sealed record LinkedInTelefone(string Numero, string? Tipo);

public sealed record LinkedInSite(string? Tipo, string Url);

public sealed record LinkedInExperiencia(string? Empresa, string? Cargo, string? Descricao, string? Local,
    string? Inicio, string? Fim);

public sealed record LinkedInFormacao(string Instituicao, string? Grau, string? Notas, string? Inicio, string? Fim);

public sealed record LinkedInCertificacao(string Nome, string? Autoridade, string? Inicio, string? Fim);

public sealed record LinkedInIdioma(string Nome, string? Nivel);

public sealed record LinkedInProjeto(string Titulo, string? Descricao, string? Inicio, string? Fim);
