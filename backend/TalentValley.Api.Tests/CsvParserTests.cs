using TalentValley.Api.Services;

namespace TalentValley.Api.Tests;

public sealed class CsvParserTests
{
    [Fact]
    public void Quoted_fields_keep_commas_double_quotes_and_line_breaks()
    {
        var records = CsvParser.ParseRecords("a,b,c\r\n\"x, y\",\"say \"\"hi\"\"\",\"line 1\nline 2\"\r\n");

        Assert.Equal(2, records.Count);
        Assert.Equal(["x, y", "say \"hi\"", "line 1\nline 2"], records[1]);
    }

    [Fact]
    public void Last_record_without_trailing_line_break_and_blank_lines_are_handled()
    {
        var records = CsvParser.ParseRecords("a,b\n\n1,2\r\n\r\n3,4");

        Assert.Equal(3, records.Count);
        Assert.Equal(["3", "4"], records[2]);
    }

    [Fact]
    public void Bom_and_empty_fields_are_tolerated()
    {
        var records = CsvParser.ParseRecords("\uFEFFName,Other\n,\"\"\nvalue,\n");

        Assert.Equal(["Name", "Other"], records[0]);
        Assert.Single(records.Skip(1));
        Assert.Equal(["value", ""], records[1]);
    }

    [Fact]
    public void Unterminated_quote_and_stray_quote_do_not_throw()
    {
        var records = CsvParser.ParseRecords("a,b\nsay \"hi\",\"never closed\nstill text");

        Assert.Equal("say \"hi\"", records[1][0]);
        Assert.Equal("never closed\nstill text", records[1][1]);
    }

    [Fact]
    public void Table_matches_columns_without_regard_to_case_or_spaces_and_skips_missing_cells()
    {
        var rows = CsvParser.ParseTable("\uFEFF Company Name ,TITLE\nAcme\nBeta,Dev\n");

        Assert.Equal(2, rows.Count);
        Assert.Equal("Acme", rows[0]["company name"]);
        Assert.False(rows[0].ContainsKey("title"));
        Assert.Equal("Dev", rows[1]["Title"]);
    }

    [Theory]
    [InlineData("")]
    [InlineData("OnlyHeader,Here\n")]
    public void Text_without_data_rows_gives_no_rows(string text) =>
        Assert.Empty(CsvParser.ParseTable(text));
}
