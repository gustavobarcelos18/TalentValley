using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TalentValley.Api.Domain.Entities;

namespace TalentValley.Api.Data.Configurations;

public sealed class AlunoCompetenciaConfiguration : IEntityTypeConfiguration<AlunoCompetencia>
{
    public void Configure(EntityTypeBuilder<AlunoCompetencia> builder)
    {
        builder.HasKey(x => new { x.AlunoId, x.CompetenciaId });

        builder.HasOne(x => x.Aluno).WithMany(x => x.Competencias)
            .HasForeignKey(x => x.AlunoId).OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Competencia).WithMany(x => x.Alunos)
            .HasForeignKey(x => x.CompetenciaId).OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => new { x.CompetenciaId, x.AlunoId });
    }
}
