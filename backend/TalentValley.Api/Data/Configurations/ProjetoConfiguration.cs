using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TalentValley.Api.Domain.Entities;

namespace TalentValley.Api.Data.Configurations;

public sealed class ProjetoConfiguration : IEntityTypeConfiguration<Projeto>
{
    public void Configure(EntityTypeBuilder<Projeto> builder)
    {
        builder.ToTable("Projetos", table =>
            table.HasCheckConstraint("CK_Projetos_Ordem", "\"Ordem\" IN (1, 2)"));

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Nome).IsRequired().HasMaxLength(200);

        builder.Property(x => x.Descricao).IsRequired().HasMaxLength(1000);

        builder.Property(x => x.DemoUrl).HasMaxLength(2048);

        builder.Property(x => x.RepositorioUrl).HasMaxLength(2048);

        builder.HasOne(x => x.Aluno).WithMany(x => x.Projetos)
            .HasForeignKey(x => x.AlunoId).OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => x.AlunoId);

        builder.HasIndex(x => x.AtualizadoEm);

        builder.HasIndex(x => new { x.AlunoId, x.Ordem }).IsUnique();
    }
}
