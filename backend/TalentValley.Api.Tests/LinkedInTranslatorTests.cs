using TalentValley.Api.Domain.Enums;
using TalentValley.Api.Services;

namespace TalentValley.Api.Tests;

public sealed class LinkedInTranslatorTests
{
    // U+FFFE is not a character; it is built from its number so it stays visible in the source.
    private static readonly string NotACharacter = ((char)0xFFFE).ToString();

    [Theory]
    [InlineData("Jan 2024", 2024, 1)]
    [InlineData("dez. de 2023", 2023, 12)]
    [InlineData("Março 2022", 2022, 3)]
    [InlineData("May 2026", 2026, 5)]
    [InlineData("08/2021", 2021, 8)]
    public void Month_dates_are_read(string text, int year, int month)
    {
        var parsed = LinkedInTranslator.ParseMonth(text);

        Assert.Equal(new LinkedInMonth(year, month), parsed);
        Assert.Equal(new DateOnly(year, month, 1), parsed!.Value.Start);
    }

    [Theory]
    [InlineData("Jan ２０２４")]
    [InlineData("٠١/2024")]
    [InlineData("01/٢٠٢٤")]
    public void Dates_written_with_non_ascii_digits_are_not_read(string text) =>
        Assert.Null(LinkedInTranslator.ParseMonth(text));

    [Fact]
    public void Characters_that_are_not_assigned_are_ignored_instead_of_failing()
    {
        Assert.Equal(new LinkedInMonth(2024, 1), LinkedInTranslator.ParseMonth("Jan" + NotACharacter + " 2024"));
        Assert.Equal(NivelIdioma.FLUENTE, LinkedInTranslator.ParseLanguageLevel("FULL" + NotACharacter + "_PROFESSIONAL"));
        Assert.Equal(TipoFormacao.TECNICO, LinkedInTranslator.FormationType("Técnico" + NotACharacter + " em Redes"));
        Assert.Equal("abc", LinkedInTranslator.Clean("a" + NotACharacter + "bc", 10, false).Value);
        Assert.Equal("minas gerais", LinkedInTranslator.Normalize("Minas" + NotACharacter + " Gerais"));
    }

    [Theory]
    [InlineData("Present", true)]
    [InlineData("presente", true)]
    [InlineData("Jan 2024", false)]
    [InlineData(null, false)]
    public void Present_text_means_not_ended(string? text, bool expected) =>
        Assert.Equal(expected, LinkedInTranslator.IsOngoingText(text));

    [Fact]
    public void Year_only_date_starts_in_january_and_ends_in_december()
    {
        var parsed = LinkedInTranslator.ParseMonth("2021");

        Assert.Equal(new DateOnly(2021, 1, 1), parsed!.Value.Start);
        Assert.Equal(new DateOnly(2021, 12, 31), parsed.Value.End);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Present")]
    [InlineData("Foo 2024")]
    [InlineData("13/2024")]
    [InlineData("0000")]
    [InlineData("ontem")]
    public void Unreadable_dates_give_null(string? text) => Assert.Null(LinkedInTranslator.ParseMonth(text));

    [Theory]
    [InlineData("NATIVE_OR_BILINGUAL", NivelIdioma.NATIVO)]
    [InlineData("FULL_PROFESSIONAL", NivelIdioma.FLUENTE)]
    [InlineData("PROFESSIONAL_WORKING", NivelIdioma.AVANCADO)]
    [InlineData("LIMITED_WORKING", NivelIdioma.INTERMEDIARIO)]
    [InlineData("ELEMENTARY", NivelIdioma.BASICO)]
    [InlineData("Native or bilingual proficiency", NivelIdioma.NATIVO)]
    [InlineData("Competência profissional plena", NivelIdioma.FLUENTE)]
    [InlineData("Competência profissional limitada", NivelIdioma.INTERMEDIARIO)]
    public void Language_levels_follow_the_approved_table(string text, NivelIdioma expected) =>
        Assert.Equal(expected, LinkedInTranslator.ParseLanguageLevel(text));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("SOMETHING_NEW")]
    public void Missing_or_unknown_language_level_gives_null(string? text) =>
        Assert.Null(LinkedInTranslator.ParseLanguageLevel(text));

    [Theory]
    [InlineData("Estagiária de TI", TipoExperiencia.ESTAGIO)]
    [InlineData("Software Engineering Intern", TipoExperiencia.ESTAGIO)]
    [InlineData("Estágio em dados", TipoExperiencia.ESTAGIO)]
    [InlineData("Analista Jr", TipoExperiencia.PROFISSIONAL)]
    [InlineData("Internal Auditor", TipoExperiencia.PROFISSIONAL)]
    [InlineData("International Sales", TipoExperiencia.PROFISSIONAL)]
    public void Experience_type_comes_from_the_role(string role, TipoExperiencia expected) =>
        Assert.Equal(expected, LinkedInTranslator.ExperienceType(role));

    [Theory]
    [InlineData("Pós-graduação em Dados", TipoFormacao.POS_GRADUACAO)]
    [InlineData("MBA em Gestão", TipoFormacao.POS_GRADUACAO)]
    [InlineData("Mestrado em Física", TipoFormacao.POS_GRADUACAO)]
    [InlineData("Master of Science", TipoFormacao.POS_GRADUACAO)]
    [InlineData("Masterclass de Excel", TipoFormacao.CURSO_LIVRE)]
    [InlineData("Tecnólogo em Redes", TipoFormacao.TECNOLOGO)]
    [InlineData("Técnico em Informática", TipoFormacao.TECNICO)]
    [InlineData("Bacharelado em Sistemas de Informação", TipoFormacao.GRADUACAO)]
    [InlineData("Bachelor's degree", TipoFormacao.GRADUACAO)]
    [InlineData("Licenciatura em Matemática", TipoFormacao.GRADUACAO)]
    [InlineData("Curso de Excel", TipoFormacao.CURSO_LIVRE)]
    public void Formation_type_comes_from_the_degree_name(string degree, TipoFormacao expected) =>
        Assert.Equal(expected, LinkedInTranslator.FormationType(degree));

    [Theory]
    [InlineData("Rio Pomba, Minas Gerais, Brazil", "Rio Pomba", "MG")]
    [InlineData("São Paulo, State of São Paulo, Brazil", "São Paulo", "SP")]
    [InlineData("Ubá, MG", "Ubá", "MG")]
    [InlineData("Brasília, Distrito Federal, Brasil", "Brasília", "DF")]
    public void Brazilian_location_is_split_into_city_and_uf(string text, string city, string uf) =>
        Assert.Equal((city, uf), LinkedInTranslator.ParseLocation(text));

    [Theory]
    [InlineData(null)]
    [InlineData("Brazil")]
    [InlineData("Minas Gerais, Brazil")]
    [InlineData("Paris, Île-de-France, France")]
    [InlineData("Cidade 2, Minas Gerais, Brazil")]
    public void Location_that_is_not_city_and_brazilian_state_gives_null(string? text) =>
        Assert.Null(LinkedInTranslator.ParseLocation(text));

    [Theory]
    [InlineData("+55 32 99999-0000", "32999990000")]
    [InlineData("(32) 3333-4444", "3233334444")]
    [InlineData("32999990000", "32999990000")]
    public void Brazilian_phone_is_normalized(string text, string expected) =>
        Assert.Equal(expected, LinkedInTranslator.BrazilianPhone(text));

    [Theory]
    [InlineData(null)]
    [InlineData("+1 415 555 0100")]
    [InlineData("12345")]
    public void Phone_that_is_not_brazilian_gives_null(string? text) =>
        Assert.Null(LinkedInTranslator.BrazilianPhone(text));

    [Fact]
    public void Clean_removes_emoji_and_says_so()
    {
        var cleaned = LinkedInTranslator.Clean("Dados 🚀 e   café ☕", 100, false);

        Assert.Equal("Dados e café", cleaned.Value);
        Assert.Equal(["Emojis removidos do texto."], cleaned.Warnings);
    }

    [Fact]
    public void Clean_cuts_long_text_and_says_so()
    {
        var cleaned = LinkedInTranslator.Clean(new string('a', 30), 10, false);

        Assert.Equal(new string('a', 10), cleaned.Value);
        Assert.Equal(["Texto cortado em 10 caracteres."], cleaned.Warnings);
    }

    [Fact]
    public void Clean_does_not_split_a_surrogate_pair_when_cutting()
    {
        var cleaned = LinkedInTranslator.Clean("abcd\U0001D11E\U0001D11E", 5, false);

        Assert.Equal("abcd", cleaned.Value);
    }

    [Fact]
    public void Clean_keeps_line_breaks_only_in_long_text()
    {
        Assert.Equal("a\nb", LinkedInTranslator.Clean("a\nb", 10, true).Value);
        Assert.Equal("a b", LinkedInTranslator.Clean("a\nb", 10, false).Value);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("   ")]
    [InlineData("🚀")]
    public void Clean_gives_null_when_nothing_is_left(string? text) =>
        Assert.Null(LinkedInTranslator.Clean(text, 10, false).Value);
}
