using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Services;

namespace TalentValley.Api.Tests;

public sealed class AdminDatabaseTests
{
    [Fact]
    public async Task Database_unique_email_constraint_protects_writes_that_bypass_Identity_validation()
    {
        using var factory = new ApiFactory();
        var first = await factory.CreateUserAsync("one@example.test");
        var second = await factory.CreateUserAsync("two@example.test");
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            var user = await db.Users.SingleAsync(x => x.Id == second);
            user.NormalizedEmail = (await db.Users.SingleAsync(x => x.Id == first)).NormalizedEmail;
            var error = await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
            Assert.Equal(2067, Assert.IsType<SqliteException>(error.InnerException).SqliteExtendedErrorCode);
        });
    }

    [Fact]
    public async Task Phase_three_migration_backfills_names_and_UTC_timestamps_without_losing_precision()
    {
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite("Data Source=:memory:").AddInterceptors(new SqliteConnectionInterceptor()).Options);
        await db.Database.OpenConnectionAsync();
        var migrator = db.GetService<IMigrator>();
        await migrator.MigrateAsync("20260911102241_InitialCreate");
        var id = Guid.NewGuid();
        await db.Database.ExecuteSqlAsync($"""
            INSERT INTO AspNetUsers (Id, NomeCompleto, NomeBusca, CriadoEm, EmailConfirmed,
                PhoneNumberConfirmed, TwoFactorEnabled, LockoutEnabled, AccessFailedCount)
            VALUES ({id}, 'Carlos', 'carlos', '2026-09-11 12:00:00+00:00', 0, 0, 0, 0, 0);
            """);
        await db.Database.ExecuteSqlAsync($"""
            INSERT INTO Recrutadores (UserId, Empresa, Cargo, Telefone, Cidade, Uf, Status)
            VALUES ({id}, '  Inovação   Ágil  ', 'Analista', '123', 'Cataguases', 'MG', 'ATIVO');
            """);
        var auditId = Guid.NewGuid();
        var timestamp = "2026-09-11 09:00:00.1234567-03:00";
        await db.Database.ExecuteSqlAsync($"""
            INSERT INTO Auditorias (Id, AdminEmailSnapshot, Acao, EntidadeTipo, EntidadeId, Descricao, CriadoEm)
            VALUES ({auditId}, 'admin@example.test', 'RECRUTADOR_CRIADO', 'RECRUTADOR', {id.ToString()}, 'Criado.', {timestamp});
            """);
        await migrator.MigrateAsync();
        Assert.Equal("inovacao agil", (await db.Recrutadores.SingleAsync()).EmpresaBusca);
        var expected = new DateTimeOffset(2026, 9, 11, 12, 0, 0, TimeSpan.Zero).AddTicks(1234567);
        Assert.Equal(expected, (await db.Auditorias.SingleAsync()).CriadoEm);
        Assert.Equal(TimeSpan.Zero, (await db.Auditorias.SingleAsync()).CriadoEm.Offset);
        db.Auditorias.Add(new Auditoria
        {
            Id = Guid.NewGuid(), AdminEmailSnapshot = "admin@example.test", EntidadeTipo = "ALUNO",
            EntidadeId = Guid.NewGuid().ToString(), Descricao = "Criado.", CriadoEm = expected.AddTicks(1)
        });
        await db.SaveChangesAsync();
        Assert.Equal(expected.AddTicks(1), await db.Auditorias.OrderByDescending(x => x.CriadoEm).Select(x => x.CriadoEm).FirstAsync());
        db.ChangeTracker.Clear();
        await migrator.MigrateAsync("20260911102241_InitialCreate");
        await migrator.MigrateAsync();
        Assert.Equal(expected, (await db.Auditorias.SingleAsync(x => x.Id == auditId)).CriadoEm);
        Assert.Equal("inovacao agil", (await db.Recrutadores.SingleAsync()).EmpresaBusca);
    }

    [Theory]
    [InlineData("João Silva", "joao-silva")]
    [InlineData("  Érica---da / Conceição  ", "erica-da-conceicao")]
    [InlineData("---", "aluno")]
    public void Slug_handles_accents_and_separators(string input, string expected) =>
        Assert.Equal(expected, SlugService.BaseSlug(input));

    [Fact]
    public async Task Long_slug_collisions_reserve_suffix_space()
    {
        using var factory = new ApiFactory();
        var id = await factory.CreateUserAsync("person@example.test");
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            var name = new string('a', 200);
            (await db.Alunos.SingleAsync(x => x.UserId == id)).Slug = SlugService.BaseSlug(name);
            await db.SaveChangesAsync();
            var slug = await provider.GetRequiredService<SlugService>().GenerateAsync(name);
            Assert.Equal(new string('a', 178) + "-2", slug);
            Assert.Equal(180, slug.Length);
        });
    }
}
