using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Domain.Entities;

namespace TalentValley.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>(options), IDataProtectionKeyContext
{
    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();
    public DbSet<Aluno> Alunos => Set<Aluno>();
    public DbSet<Recrutador> Recrutadores => Set<Recrutador>();
    public DbSet<Competencia> Competencias => Set<Competencia>();
    public DbSet<AlunoCompetencia> AlunoCompetencias => Set<AlunoCompetencia>();
    public DbSet<Idioma> Idiomas => Set<Idioma>();
    public DbSet<AlunoIdioma> AlunoIdiomas => Set<AlunoIdioma>();
    public DbSet<Formacao> Formacoes => Set<Formacao>();
    public DbSet<Experiencia> Experiencias => Set<Experiencia>();
    public DbSet<Projeto> Projetos => Set<Projeto>();
    public DbSet<ProjetoCompetencia> ProjetoCompetencias => Set<ProjetoCompetencia>();
    public DbSet<AlunoDisponibilidade> AlunoDisponibilidades => Set<AlunoDisponibilidade>();
    public DbSet<AlunoModalidade> AlunoModalidades => Set<AlunoModalidade>();
    public DbSet<AlunoAreaInteresse> AlunoAreasInteresse => Set<AlunoAreaInteresse>();
    public DbSet<AlunoCategoriaCnh> AlunoCategoriasCnh => Set<AlunoCategoriaCnh>();
    public DbSet<AlunoTipoDeficiencia> AlunoTiposDeficiencia => Set<AlunoTipoDeficiencia>();
    public DbSet<Favorito> Favoritos => Set<Favorito>();
    public DbSet<Auditoria> Auditorias => Set<Auditoria>();
    public DbSet<SolicitacaoCadastro> SolicitacoesCadastro => Set<SolicitacaoCadastro>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }

    // PostgreSQL timestamptz keeps microseconds while .NET keeps 100 ns ticks. Rounding the tracked values before
    // saving makes what a request returns right after a write identical to what a later read returns.
    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        TruncateTimestampsToMicroseconds();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        TruncateTimestampsToMicroseconds();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private void TruncateTimestampsToMicroseconds()
    {
        foreach (var entry in ChangeTracker.Entries().Where(x => x.State is EntityState.Added or EntityState.Modified))
            foreach (var property in entry.Properties)
                if (property.CurrentValue is DateTimeOffset value && value.Ticks % 10 != 0)
                    property.CurrentValue = value.AddTicks(-(value.Ticks % 10));
    }
}
