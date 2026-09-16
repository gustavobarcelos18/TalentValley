using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Domain.Entities;

namespace TalentValley.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>(options)
{
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
    public DbSet<Favorito> Favoritos => Set<Favorito>();
    public DbSet<Auditoria> Auditorias => Set<Auditoria>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
