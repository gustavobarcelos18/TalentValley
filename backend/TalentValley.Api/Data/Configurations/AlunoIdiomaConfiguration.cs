using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TalentValley.Api.Domain.Entities;

namespace TalentValley.Api.Data.Configurations;

public sealed class AlunoIdiomaConfiguration : IEntityTypeConfiguration<AlunoIdioma>
{
    public void Configure(EntityTypeBuilder<AlunoIdioma> builder)
    {
        builder.HasKey(x => new { x.AlunoId, x.IdiomaId });

        builder.Property(x => x.Nivel).HasConversion<string>();

        builder.HasOne(x => x.Aluno).WithMany(x => x.Idiomas)
            .HasForeignKey(x => x.AlunoId).OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Idioma).WithMany(x => x.Alunos)
            .HasForeignKey(x => x.IdiomaId).OnDelete(DeleteBehavior.Restrict);
    }
}
