using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TalentValley.Api.Domain.Entities;

namespace TalentValley.Api.Data.Configurations;

public sealed class ProjetoCompetenciaConfiguration : IEntityTypeConfiguration<ProjetoCompetencia>
{
    public void Configure(EntityTypeBuilder<ProjetoCompetencia> builder)
    {
        builder.HasKey(x => new { x.ProjetoId, x.CompetenciaId });

        builder.HasOne(x => x.Projeto).WithMany(x => x.Competencias)
            .HasForeignKey(x => x.ProjetoId).OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Competencia).WithMany(x => x.Projetos)
            .HasForeignKey(x => x.CompetenciaId).OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => new { x.CompetenciaId, x.ProjetoId });
    }
}
