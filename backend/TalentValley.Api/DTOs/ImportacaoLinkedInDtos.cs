using TalentValley.Api.Domain.Enums;

namespace TalentValley.Api.DTOs;

// Preview of a LinkedIn import. Nothing here is saved: the screen saves the chosen items with the existing endpoints.
public enum SituacaoItemImportacao { NOVO, JA_EXISTE, NAO_IMPORTAVEL }

public enum CampoContatoImportacao { BIO, TELEFONE, EMAIL_PROFISSIONAL, GITHUB_URL, PORTFOLIO_URL }

public enum SecaoImportacao { LOCALIZACAO, CONTATO, COMPETENCIA, IDIOMA }

// Items that cannot be imported have Situacao NAO_IMPORTAVEL and a Motivo; their other fields may be empty.
public sealed record CampoImportacaoPrevia(CampoContatoImportacao Campo, string Valor,
    SituacaoItemImportacao Situacao, IReadOnlyList<string> Avisos);

public sealed record LocalizacaoImportacaoPrevia(string Cidade, string Uf, SituacaoItemImportacao Situacao);

public sealed record ExperienciaImportacaoPrevia(string? Empresa, string? Cargo, TipoExperiencia? Tipo,
    DateOnly? DataInicio, DateOnly? DataFim, bool Atual, string? Descricao,
    SituacaoItemImportacao Situacao, string? Motivo, IReadOnlyList<string> Avisos);

public sealed record FormacaoImportacaoPrevia(string? Nome, string? Instituicao, TipoFormacao? Tipo,
    DateOnly? DataInicio, DateOnly? DataFim, StatusFormacao? Status,
    SituacaoItemImportacao Situacao, string? Motivo, IReadOnlyList<string> Avisos);

public sealed record ProjetoImportacaoPrevia(string? Nome, DateOnly? DataInicio, DateOnly? DataFim, bool EmAndamento,
    string? Descricao, SituacaoItemImportacao Situacao, string? Motivo, IReadOnlyList<string> Avisos);

public sealed record CompetenciaImportacaoPrevia(int Id, string Nome, TipoCompetencia Tipo,
    SituacaoItemImportacao Situacao, string? Motivo);

public sealed record IdiomaImportacaoPrevia(int IdiomaId, string Nome, NivelIdioma? Nivel,
    SituacaoItemImportacao Situacao, string? Motivo);

public sealed record NaoReconhecidoImportacao(SecaoImportacao Secao, string Valor, string Motivo);

public sealed record ImportacaoLinkedInPreviaResponse(
    IReadOnlyList<CampoImportacaoPrevia> Campos,
    LocalizacaoImportacaoPrevia? Localizacao,
    IReadOnlyList<ExperienciaImportacaoPrevia> Experiencias,
    IReadOnlyList<FormacaoImportacaoPrevia> Formacoes,
    IReadOnlyList<FormacaoImportacaoPrevia> Certificacoes,
    IReadOnlyList<CompetenciaImportacaoPrevia> Competencias,
    IReadOnlyList<IdiomaImportacaoPrevia> Idiomas,
    IReadOnlyList<ProjetoImportacaoPrevia> Projetos,
    int VagasProjetos,
    IReadOnlyList<NaoReconhecidoImportacao> NaoReconhecidos);
