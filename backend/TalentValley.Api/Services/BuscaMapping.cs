using TalentValley.Api.Domain.Entities;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Services;

internal static class BuscaMapping
{
    // Business rule: a search status not reconfirmed for this many days is shown with a "desatualizado" warning.
    public const int PrazoStatusBuscaDias = 30;

    public static bool StatusDesatualizado(Aluno aluno, DateTimeOffset now) =>
        aluno.StatusBusca is not null && aluno.StatusBuscaConfirmadoEm is { } confirmedAt &&
        now - confirmedAt > TimeSpan.FromDays(PrazoStatusBuscaDias);

    public static BuscaResponse Map(Aluno aluno, DateTimeOffset now) => new(
        aluno.StatusBusca,
        aluno.StatusBuscaConfirmadoEm,
        StatusDesatualizado(aluno, now),
        aluno.ObjetivoProfissional,
        aluno.AreasInteresse.Select(x => x.Area).Order().ToList(),
        aluno.DisponivelImediatamente,
        aluno.DisponivelAPartirDe,
        aluno.CargaHorariaSemanal,
        aluno.AceitaViajar,
        aluno.AceitaMudarDeCidade,
        aluno.CategoriasCnh.Select(x => x.Categoria).Order().ToList(),
        aluno.PossuiVeiculoProprio,
        new(aluno.SouPcd, aluno.InteresseVagaPcd,
            aluno.TiposDeficiencia.Select(x => x.Tipo).Order().ToList(), aluno.ConsentimentoPcdEm));
}
