using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;

namespace TalentValley.Api.Services;

public sealed class CatalogSeedService(AppDbContext database)
{
    public static readonly string[] CompetenciaNames =
    [
        "C#", "ASP.NET Core", "Java", "Python", "JavaScript", "TypeScript",
        "React", "Next.js", "HTML", "CSS", "SQL", "Git", "Docker"
    ];

    public static readonly string[] IdiomaNames =
    [
        "Português", "Inglês", "Espanhol", "Francês", "Alemão"
    ];

    public async Task InitializeAsync()
    {
        await SeedCompetenciasAsync();
        await SeedIdiomasAsync();
    }

    private async Task SeedCompetenciasAsync()
    {
        var existing = await database.Competencias.Select(x => x.NomeBusca).ToHashSetAsync();
        foreach (var nome in CompetenciaNames)
        {
            var busca = NameNormalizer.Normalize(nome);
            if (!existing.Contains(busca))
                database.Competencias.Add(new() { Nome = nome, NomeBusca = busca });
        }
        await database.SaveChangesAsync();
    }

    private async Task SeedIdiomasAsync()
    {
        var existing = await database.Idiomas.Select(x => x.NomeBusca).ToHashSetAsync();
        foreach (var nome in IdiomaNames)
        {
            var busca = NameNormalizer.Normalize(nome);
            if (!existing.Contains(busca))
                database.Idiomas.Add(new() { Nome = nome, NomeBusca = busca });
        }
        await database.SaveChangesAsync();
    }
}
