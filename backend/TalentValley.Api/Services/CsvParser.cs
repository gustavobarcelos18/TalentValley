using System.Text;

namespace TalentValley.Api.Services;

// Minimal RFC 4180 reader: quoted fields, commas, doubled quotes and line breaks inside quotes.
// Lenient on purpose: a stray quote inside an unquoted field is kept as text and an unterminated
// quote runs to the end of the text, because exports from other tools are not always perfect.
public static class CsvParser
{
    public static IReadOnlyList<IReadOnlyList<string>> ParseRecords(string text)
    {
        var records = new List<IReadOnlyList<string>>();
        var fields = new List<string>();
        var field = new StringBuilder();
        var index = text.Length > 0 && text[0] == '\uFEFF' ? 1 : 0;

        while (index < text.Length)
        {
            var current = text[index];
            if (current == '"' && field.Length == 0)
            {
                index = ReadQuoted(text, index + 1, field);
                continue;
            }

            index++;
            if (current == ',')
            {
                EndField(fields, field);
            }
            else if (current is '\r' or '\n')
            {
                if (current == '\r' && index < text.Length && text[index] == '\n') index++;
                EndField(fields, field);
                EndRecord(records, fields);
            }
            else
            {
                field.Append(current);
            }
        }

        if (field.Length > 0 || fields.Count > 0)
        {
            EndField(fields, field);
            EndRecord(records, fields);
        }

        return records;
    }

    // The first record is the header. Column names are trimmed and matched without regard to case.
    // A missing column is simply absent from the row; blank lines are skipped.
    public static IReadOnlyList<IReadOnlyDictionary<string, string>> ParseTable(string text)
    {
        var records = ParseRecords(text);
        if (records.Count < 2) return [];

        var header = records[0].Select(name => name.Trim()).ToList();
        var rows = new List<IReadOnlyDictionary<string, string>>(records.Count - 1);
        foreach (var record in records.Skip(1))
        {
            var row = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            for (var column = 0; column < header.Count && column < record.Count; column++)
            {
                if (header[column].Length > 0) row.TryAdd(header[column], record[column]);
            }

            rows.Add(row);
        }

        return rows;
    }

    // Returns the index just after the closing quote (or the end of the text when it is never closed).
    private static int ReadQuoted(string text, int index, StringBuilder field)
    {
        while (index < text.Length)
        {
            var current = text[index++];
            if (current != '"')
            {
                field.Append(current);
            }
            else if (index < text.Length && text[index] == '"')
            {
                field.Append('"');
                index++;
            }
            else
            {
                return index;
            }
        }

        return index;
    }

    private static void EndField(List<string> fields, StringBuilder field)
    {
        fields.Add(field.ToString());
        field.Clear();
    }

    private static void EndRecord(List<IReadOnlyList<string>> records, List<string> fields)
    {
        if (fields.Exists(value => value.Length > 0)) records.Add(fields.ToArray());
        fields.Clear();
    }
}
