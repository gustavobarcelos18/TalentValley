using TalentValley.Api.Domain.Enums;

namespace TalentValley.Api.DTOs;

// LGPD data export (GET /api/alunos/me/exportacao and /api/recrutador/me/exportacao).
// Files are reported only as present/absent plus type; neither content nor internal storage names are exported.
public sealed record ExportacaoConta(string? Email, DateTimeOffset CriadoEm, DateTimeOffset? UltimoLoginEm);

public sealed record ExportacaoConsentimentos(
    DateTimeOffset? ConsentimentoEm, string? VersaoTermos, bool NewsletterAceita, DateTimeOffset? NewsletterAtualizadaEm);

public sealed record ExportacaoArquivo(bool Possui, string? Tipo);

public sealed record ExportacaoAlunoResponse(
    DateTimeOffset GeradoEm,
    ExportacaoConta Conta,
    ExportacaoConsentimentos Consentimentos,
    string Slug,
    bool Ativo,
    ExportacaoDadosBasicos DadosBasicos,
    SobreResponse Sobre,
    ContatoResponse Contato,
    ExportacaoArquivo Foto,
    ExportacaoArquivo Curriculo,
    IReadOnlyCollection<CompetenciaResponse> Competencias,
    IReadOnlyCollection<AlunoIdiomaResponse> Idiomas,
    IReadOnlyCollection<TipoDisponibilidade> Disponibilidades,
    IReadOnlyCollection<ModalidadeTrabalho> Modalidades,
    BuscaResponse Busca,
    IReadOnlyCollection<FormacaoResponse> Formacoes,
    IReadOnlyCollection<ExperienciaResponse> Experiencias,
    IReadOnlyCollection<ProjetoResponse> Projetos,
    DateTimeOffset AtualizadoEm);

public sealed record ExportacaoDadosBasicos(string NomeCompleto, string? Cidade, string? Uf);

// Favorites point at students, so only the total and the dates are exported, never student data.
public sealed record ExportacaoFavoritos(int Total, IReadOnlyCollection<DateTimeOffset> FavoritadosEm);

public sealed record ExportacaoRecrutadorResponse(
    DateTimeOffset GeradoEm,
    ExportacaoConta Conta,
    ExportacaoConsentimentos Consentimentos,
    string NomeCompleto,
    string Empresa,
    string Cargo,
    string Telefone,
    string Cidade,
    string Uf,
    StatusRecrutador Status,
    ExportacaoFavoritos Favoritos);
