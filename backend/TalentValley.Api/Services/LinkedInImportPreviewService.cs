using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;
using TalentValley.Api.Storage;

namespace TalentValley.Api.Services;

// Builds the preview of a LinkedIn import. It only reads: nothing is saved, the file is not stored and it is not logged.
// The student reviews the preview and saves the chosen items with the existing profile endpoints.
public sealed class LinkedInImportPreviewService(AppDbContext database, FileUploadValidator validator,
    LinkedInExportReader reader)
{
    private const int MaxProjects = 2;
    private const int MaxNameLength = 200;
    private const int MaxCompanyLength = 150;
    private const int MaxRoleLength = 150;
    private const int MaxShownValueLength = 200;
    private const int MaxLongTextLength = 2000;
    private const int MaxBioLength = 1500;
    private const int MaxProjectDescriptionLength = 1000;
    private const int MaxUrlLength = 2048;
    private const int MaxEmailLength = 254;
    private const string OutOfRange = "Data fora do intervalo permitido.";

    private static readonly IReadOnlyList<string> NoWarnings = [];

    public async Task<ImportacaoLinkedInPreviaResponse?> PreviewAsync(Guid alunoId, IFormFile? file,
        CancellationToken cancellationToken)
    {
        var upload = await validator.ValidateAsync(file, UploadKind.Zip, cancellationToken);
        LinkedInImportedData data;
        await using (var stream = upload.File.OpenReadStream())
            data = reader.Read(stream);

        var current = await LoadCurrentAsync(alunoId, cancellationToken);
        return current is null ? null : Build(data, current, DateOnly.FromDateTime(DateTime.UtcNow));
    }

    private async Task<CurrentProfile?> LoadCurrentAsync(Guid alunoId, CancellationToken cancellationToken)
    {
        var aluno = await database.Alunos.AsNoTracking().Where(x => x.UserId == alunoId)
            .Select(x => new { x.Cidade, x.Uf, x.Telefone, x.EmailProfissional, x.GitHubUrl, x.PortfolioUrl, x.Bio })
            .SingleOrDefaultAsync(cancellationToken);
        if (aluno is null) return null;

        var experiences = await database.Experiencias.AsNoTracking().Where(x => x.AlunoId == alunoId)
            .Select(x => new { x.Empresa, x.Cargo, x.DataInicio }).ToListAsync(cancellationToken);
        var formations = await database.Formacoes.AsNoTracking().Where(x => x.AlunoId == alunoId)
            .Select(x => new { x.Nome, x.Instituicao, x.DataInicio }).ToListAsync(cancellationToken);
        var projectNames = await database.Projetos.AsNoTracking().Where(x => x.AlunoId == alunoId)
            .Select(x => x.Nome).ToListAsync(cancellationToken);
        var competencyIds = await database.AlunoCompetencias.AsNoTracking().Where(x => x.AlunoId == alunoId)
            .Select(x => x.CompetenciaId).ToListAsync(cancellationToken);
        var languageIds = await database.AlunoIdiomas.AsNoTracking().Where(x => x.AlunoId == alunoId)
            .Select(x => x.IdiomaId).ToListAsync(cancellationToken);
        var competencyCatalog = await database.Competencias.AsNoTracking().ToListAsync(cancellationToken);
        var languageCatalog = await database.Idiomas.AsNoTracking().ToListAsync(cancellationToken);

        var competencyById = competencyCatalog.ToDictionary(x => x.Id);
        return new CurrentProfile(
            new(aluno.Cidade, aluno.Uf, aluno.Telefone, aluno.EmailProfissional, aluno.GitHubUrl, aluno.PortfolioUrl, aluno.Bio),
            new KnownItems(experiences.Select(x => (x.Empresa, x.Cargo, x.DataInicio))),
            new KnownItems(formations.Select(x => (x.Nome, x.Instituicao, x.DataInicio))),
            new(projectNames.Select(LinkedInTranslator.Normalize).ToHashSet(), projectNames.Count),
            new(competencyIds.ToHashSet(),
                competencyIds.Count(id => competencyById[id].Categoria.Tipo() == TipoCompetencia.COMPORTAMENTAL),
                languageIds.ToHashSet()),
            new(competencyCatalog.GroupBy(x => x.NomeBusca).ToDictionary(x => x.Key, x => x.First()),
                languageCatalog.GroupBy(x => x.NomeBusca).ToDictionary(x => x.Key, x => x.First())));
    }

    private static ImportacaoLinkedInPreviaResponse Build(LinkedInImportedData data, CurrentProfile current, DateOnly today)
    {
        var unrecognized = new List<NaoReconhecidoImportacao>();
        var fields = BuildFields(data, current, unrecognized);
        var location = BuildLocation(data.Contato.Localizacao, current, unrecognized);
        var experiences = data.Experiencias.Select(x => BuildExperience(x, current.KnownExperiences, today)).ToList();
        var formations = data.Formacoes.Select(x => BuildFormation(x, current.KnownFormations, today)).ToList();
        var certifications = data.Certificacoes.Select(x => BuildCertification(x, current.KnownFormations, today)).ToList();
        var competencies = BuildCompetencies(data.Competencias, current, unrecognized);
        var languages = BuildLanguages(data.Idiomas, current, unrecognized);
        var projects = data.Projetos.Select(x => BuildProject(x, current.Projects.Names, today)).ToList();

        return new(fields, location, experiences, formations, certifications, competencies, languages, projects,
            Math.Max(0, MaxProjects - current.Projects.Count), unrecognized);
    }

    // ---- Contact and bio ----

    private static List<CampoImportacaoPrevia> BuildFields(LinkedInImportedData data, CurrentProfile current,
        List<NaoReconhecidoImportacao> unrecognized)
    {
        var fields = new List<CampoImportacaoPrevia>();
        AddField(fields, CampoContatoImportacao.BIO, LinkedInTranslator.Clean(data.Bio, MaxBioLength, true), current.Contact.Bio);
        AddField(fields, CampoContatoImportacao.TELEFONE, Plain(PickPhone(data.Contato.Telefones, unrecognized)), current.Contact.Telefone);
        AddField(fields, CampoContatoImportacao.EMAIL_PROFISSIONAL, Plain(PickEmail(data.Contato.Emails, unrecognized)),
            current.Contact.EmailProfissional);
        var gitHub = data.Contato.Sites.Select(x => x.Url).FirstOrDefault(IsGitHubUrl);
        AddField(fields, CampoContatoImportacao.GITHUB_URL, Plain(gitHub), current.Contact.GitHubUrl);
        AddField(fields, CampoContatoImportacao.PORTFOLIO_URL, Plain(PickPortfolio(data.Contato.Sites)), current.Contact.PortfolioUrl);
        return fields;
    }

    private static CleanedText? Plain(string? value) => value is null ? null : new CleanedText(value, NoWarnings);

    private static void AddField(List<CampoImportacaoPrevia> fields, CampoContatoImportacao field, CleanedText? cleaned,
        string? existing)
    {
        if (cleaned?.Value is not { } value) return;
        var situation = string.IsNullOrWhiteSpace(existing) ? SituacaoItemImportacao.NOVO : SituacaoItemImportacao.JA_EXISTE;
        fields.Add(new(field, value, situation, cleaned.Warnings));
    }

    private static string? PickPhone(IEnumerable<LinkedInTelefone> phones, List<NaoReconhecidoImportacao> unrecognized)
    {
        string? chosen = null;
        foreach (var phone in phones)
        {
            var valid = LinkedInTranslator.BrazilianPhone(phone.Numero);
            if (valid is null)
                unrecognized.Add(new(SecaoImportacao.CONTATO, Shown(phone.Numero), "Não é um telefone brasileiro válido."));
            else
                chosen ??= valid;
        }

        return chosen;
    }

    private static string? PickEmail(IEnumerable<LinkedInEmail> emails, List<NaoReconhecidoImportacao> unrecognized)
    {
        var primary = emails.FirstOrDefault(x => x.Primario);
        if (primary is null) return null;
        var usable = primary.Endereco.Length <= MaxEmailLength && InputValidation.IsSafeEmail(primary.Endereco)
            && !NoEmojiAttribute.ContainsEmoji(primary.Endereco);
        if (usable) return primary.Endereco;

        unrecognized.Add(new(SecaoImportacao.CONTATO, Shown(primary.Endereco), "Não é um e-mail válido."));
        return null;
    }

    private static string? PickPortfolio(IEnumerable<LinkedInSite> sites) =>
        sites.Where(x => !IsGitHubUrl(x.Url) && x.Tipo is not null
                && (x.Tipo.Equals("PORTFOLIO", StringComparison.OrdinalIgnoreCase)
                    || x.Tipo.Equals("PERSONAL", StringComparison.OrdinalIgnoreCase)))
            .Select(x => x.Url).FirstOrDefault(IsUsableUrl);

    private static bool IsUsableUrl(string url) =>
        url.Length <= MaxUrlLength && InputValidation.IsSafeHttpUrl(url) && !NoEmojiAttribute.ContainsEmoji(url);

    // Raw values from the file are shown cleaned and short, never as they came.
    private static string Shown(string raw) => LinkedInTranslator.Clean(raw, MaxShownValueLength, false).Value ?? string.Empty;

    private static bool IsGitHubUrl(string url) =>
        IsUsableUrl(url) && new Uri(url).Host is "github.com" or "www.github.com";

    // ---- Location ----

    private static LocalizacaoImportacaoPrevia? BuildLocation(string? text, CurrentProfile current,
        List<NaoReconhecidoImportacao> unrecognized)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var parsed = LinkedInTranslator.ParseLocation(text);
        if (parsed is null)
        {
            unrecognized.Add(new(SecaoImportacao.LOCALIZACAO, Shown(text), "Não foi possível identificar cidade e estado do Brasil."));
            return null;
        }

        var empty = string.IsNullOrWhiteSpace(current.Contact.Cidade) && string.IsNullOrWhiteSpace(current.Contact.Uf);
        return new(parsed.Value.Cidade, parsed.Value.Uf, empty ? SituacaoItemImportacao.NOVO : SituacaoItemImportacao.JA_EXISTE);
    }

    // ---- Dates ----

    private readonly record struct Period(LinkedInMonth? Start, LinkedInMonth? End, string? Problem);

    private static Period ParsePeriod(string? rawStart, string? rawEnd, DateOnly today)
    {
        // "Present" means the same as an empty end date: it has not ended.
        if (LinkedInTranslator.IsOngoingText(rawEnd)) rawEnd = null;
        var start = LinkedInTranslator.ParseMonth(rawStart);
        var end = LinkedInTranslator.ParseMonth(rawEnd);
        return new(start, end, PeriodProblem(rawStart, start, rawEnd, end, today));
    }

    private static string? PeriodProblem(string? rawStart, LinkedInMonth? start, string? rawEnd, LinkedInMonth? end,
        DateOnly today)
    {
        if (start is null) return rawStart is null ? "Sem data de início." : "Data de início não reconhecida.";
        if (!start.Value.IsInAllowedRange(today)) return OutOfRange;
        if (end is null) return rawEnd is null ? null : "Data de fim não reconhecida.";
        if (!end.Value.IsInAllowedRange(today)) return OutOfRange;
        return end.Value.Start < start.Value.Start ? "A data de fim é anterior à data de início." : null;
    }

    private static IReadOnlyList<string> Join(params CleanedText[] texts) => texts.SelectMany(x => x.Warnings).ToList();

    private static bool IsMeaningful(string? text) => text is not null && InputValidation.IsMeaningfulText(text);

    // The first check that fails gives the reason shown to the student.
    private static string? FirstProblem(params (bool Fails, string? Message)[] checks) =>
        checks.Where(x => x.Fails).Select(x => x.Message).FirstOrDefault();

    // ---- Experiences ----

    private static ExperienciaImportacaoPrevia BuildExperience(LinkedInExperiencia item, KnownItems known,
        DateOnly today)
    {
        var company = LinkedInTranslator.Clean(item.Empresa, MaxCompanyLength, false);
        var role = LinkedInTranslator.Clean(item.Cargo, MaxRoleLength, false);
        var description = LinkedInTranslator.Clean(item.Descricao, MaxLongTextLength, true);
        var warnings = Join(company, role, description);
        var period = ParsePeriod(item.Inicio, item.Fim, today);

        var problem = IsMeaningful(company.Value) && IsMeaningful(role.Value) ? period.Problem : "Faltam a empresa ou o cargo.";
        if (problem is not null)
            return new(company.Value, role.Value, null, null, null, false, description.Value,
                SituacaoItemImportacao.NAO_IMPORTAVEL, problem, warnings);

        var start = period.Start!.Value;
        var situation = known.Add(company.Value!, role.Value!, start)
            ? SituacaoItemImportacao.NOVO : SituacaoItemImportacao.JA_EXISTE;
        return new(company.Value, role.Value, LinkedInTranslator.ExperienceType(role.Value!), start.Start, period.End?.Start,
            period.End is null, description.Value, situation, null, warnings);
    }

    // ---- Formations and certifications ----

    private static FormacaoImportacaoPrevia BuildFormation(LinkedInFormacao item, KnownItems known, DateOnly today)
    {
        var name = LinkedInTranslator.Clean(item.Grau, MaxNameLength, false);
        var institution = LinkedInTranslator.Clean(item.Instituicao, MaxNameLength, false);
        var warnings = Join(name, institution);
        var period = ParsePeriod(item.Inicio, item.Fim, today);

        var problem = FirstProblem((!IsMeaningful(name.Value), "Sem o nome do curso."),
            (!IsMeaningful(institution.Value), "Sem a instituição."),
            (period.Problem is not null, period.Problem));
        if (problem is not null)
            return Unimportable(name.Value, institution.Value, problem, warnings);

        var start = period.Start!.Value;
        var situation = known.Add(name.Value!, institution.Value!, start)
            ? SituacaoItemImportacao.NOVO : SituacaoItemImportacao.JA_EXISTE;
        var ongoing = period.End is null || period.End.Value.End >= today;
        return new(name.Value, institution.Value, LinkedInTranslator.FormationType(name.Value!), start.Start,
            ongoing ? null : period.End!.Value.Start, ongoing ? StatusFormacao.EM_ANDAMENTO : StatusFormacao.CONCLUIDO,
            situation, null, warnings);
    }

    // The issue date of a certification is both its start and its end.
    private static FormacaoImportacaoPrevia BuildCertification(LinkedInCertificacao item, KnownItems known,
        DateOnly today)
    {
        var name = LinkedInTranslator.Clean(item.Nome, MaxNameLength, false);
        var issuer = LinkedInTranslator.Clean(item.Autoridade, MaxNameLength, false);
        var warnings = Join(name, issuer);
        var period = ParsePeriod(item.Inicio, null, today);

        var problem = FirstProblem((!IsMeaningful(name.Value), "Sem o nome da certificação."),
            (!IsMeaningful(issuer.Value), "Sem o emissor da certificação."),
            (period.Problem is not null, "Sem data de emissão válida."));
        if (problem is not null)
            return Unimportable(name.Value, issuer.Value, problem, warnings);

        var issued = period.Start!.Value;
        var situation = known.Add(name.Value!, issuer.Value!, issued)
            ? SituacaoItemImportacao.NOVO : SituacaoItemImportacao.JA_EXISTE;
        return new(name.Value, issuer.Value, TipoFormacao.CURSO_LIVRE, issued.Start, issued.Start, StatusFormacao.CONCLUIDO,
            situation, null, warnings);
    }

    private static FormacaoImportacaoPrevia Unimportable(string? name, string? institution, string reason,
        IReadOnlyList<string> warnings) =>
        new(name, institution, null, null, null, null, SituacaoItemImportacao.NAO_IMPORTAVEL, reason, warnings);

    // ---- Competencies and languages ----

    private static List<CompetenciaImportacaoPrevia> BuildCompetencies(IEnumerable<string> names, CurrentProfile current,
        List<NaoReconhecidoImportacao> unrecognized)
    {
        var result = new List<CompetenciaImportacaoPrevia>();
        var seen = new HashSet<int>();
        var behavioral = current.Skills.BehavioralCount;
        foreach (var name in names)
        {
            if (!current.Catalog.Competencies.TryGetValue(LinkedInTranslator.Normalize(name), out var competency))
            {
                unrecognized.Add(new(SecaoImportacao.COMPETENCIA, Shown(name), "Não existe no catálogo de competências."));
                continue;
            }

            if (!seen.Add(competency.Id)) continue;
            var type = competency.Categoria.Tipo();
            var alreadyHas = current.Skills.CompetencyIds.Contains(competency.Id);
            var overLimit = !alreadyHas && type == TipoCompetencia.COMPORTAMENTAL
                && behavioral >= AlunoService.MaxCompetenciasComportamentais;
            if (!alreadyHas && !overLimit && type == TipoCompetencia.COMPORTAMENTAL) behavioral++;

            result.Add(new(competency.Id, competency.Nome, type, CompetencySituation(alreadyHas, overLimit),
                overLimit ? $"Limite de {AlunoService.MaxCompetenciasComportamentais} competências comportamentais." : null));
        }

        return result;
    }

    private static SituacaoItemImportacao CompetencySituation(bool alreadyHas, bool overLimit)
    {
        if (alreadyHas) return SituacaoItemImportacao.JA_EXISTE;
        return overLimit ? SituacaoItemImportacao.NAO_IMPORTAVEL : SituacaoItemImportacao.NOVO;
    }

    private static List<IdiomaImportacaoPrevia> BuildLanguages(IEnumerable<LinkedInIdioma> items, CurrentProfile current,
        List<NaoReconhecidoImportacao> unrecognized)
    {
        var result = new List<IdiomaImportacaoPrevia>();
        var seen = new HashSet<int>();
        foreach (var item in items)
        {
            if (!current.Catalog.Languages.TryGetValue(LinkedInTranslator.Normalize(item.Nome), out var language))
            {
                unrecognized.Add(new(SecaoImportacao.IDIOMA, Shown(item.Nome), "Não existe no catálogo de idiomas."));
                continue;
            }

            if (!seen.Add(language.Id)) continue;
            var level = LinkedInTranslator.ParseLanguageLevel(item.Nivel);
            result.Add(LanguageItem(language, level, current.Skills.LanguageIds.Contains(language.Id)));
        }

        return result;
    }

    private static IdiomaImportacaoPrevia LanguageItem(Idioma language, NivelIdioma? level, bool alreadyHas)
    {
        if (alreadyHas) return new(language.Id, language.Nome, level, SituacaoItemImportacao.JA_EXISTE, null);
        if (level is null)
            return new(language.Id, language.Nome, null, SituacaoItemImportacao.NAO_IMPORTAVEL,
                "Nível de proficiência ausente ou não reconhecido.");
        return new(language.Id, language.Nome, level, SituacaoItemImportacao.NOVO, null);
    }

    // ---- Projects ----

    private static ProjetoImportacaoPrevia BuildProject(LinkedInProjeto item, HashSet<string> knownNames, DateOnly today)
    {
        var name = LinkedInTranslator.Clean(item.Titulo, MaxNameLength, false);
        var description = LinkedInTranslator.Clean(item.Descricao, MaxProjectDescriptionLength, true);
        var warnings = Join(name, description);
        var period = ParsePeriod(item.Inicio, item.Fim, today);

        var problem = FirstProblem((!IsMeaningful(name.Value), "Sem o nome do projeto."),
            (description.Value is null, "Sem descrição."),
            (period.Problem is not null, period.Problem));
        if (problem is not null)
            return new(name.Value, null, null, false, description.Value, SituacaoItemImportacao.NAO_IMPORTAVEL, problem, warnings);

        var situation = knownNames.Add(LinkedInTranslator.Normalize(name.Value!))
            ? SituacaoItemImportacao.NOVO : SituacaoItemImportacao.JA_EXISTE;
        return new(name.Value, period.Start!.Value.Start, period.End?.Start, period.End is null, description.Value,
            situation, null, warnings);
    }

    // Items already in the profile, plus the ones already seen in the file. Two items are the same when both texts
    // match (ignoring case and accents) and they start in the same month; when LinkedIn only gave a year,
    // the same year is enough.
    private sealed class KnownItems(IEnumerable<(string First, string Second, DateOnly Start)> existing)
    {
        private readonly List<(string First, string Second, DateOnly Start)> items =
            existing.Select(x => (LinkedInTranslator.Normalize(x.First), LinkedInTranslator.Normalize(x.Second), x.Start)).ToList();

        public bool Add(string first, string second, LinkedInMonth start)
        {
            var normalizedFirst = LinkedInTranslator.Normalize(first);
            var normalizedSecond = LinkedInTranslator.Normalize(second);
            if (items.Exists(x => x.First == normalizedFirst && x.Second == normalizedSecond && SameStart(x.Start, start)))
                return false;

            items.Add((normalizedFirst, normalizedSecond, start.Start));
            return true;
        }

        private static bool SameStart(DateOnly known, LinkedInMonth start) =>
            known.Year == start.Year && (start.Month is null || known.Month == start.Month);
    }

    private sealed record ContactSnapshot(string? Cidade, string? Uf, string? Telefone, string? EmailProfissional,
        string? GitHubUrl, string? PortfolioUrl, string? Bio);

    private sealed record ProjectsSnapshot(HashSet<string> Names, int Count);

    private sealed record SkillsSnapshot(HashSet<int> CompetencyIds, int BehavioralCount, HashSet<int> LanguageIds);

    private sealed record CatalogSnapshot(Dictionary<string, Competencia> Competencies, Dictionary<string, Idioma> Languages);

    private sealed record CurrentProfile(ContactSnapshot Contact, KnownItems KnownExperiences, KnownItems KnownFormations,
        ProjectsSnapshot Projects, SkillsSnapshot Skills, CatalogSnapshot Catalog);
}
