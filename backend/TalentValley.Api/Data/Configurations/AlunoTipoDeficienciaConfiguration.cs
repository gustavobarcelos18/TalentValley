using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TalentValley.Api.Domain.Entities;

namespace TalentValley.Api.Data.Configurations;

public sealed class AlunoTipoDeficienciaConfiguration : IEntityTypeConfiguration<AlunoTipoDeficiencia>
{
    public void Configure(EntityTypeBuilder<AlunoTipoDeficiencia> builder)
    {
        builder.HasKey(x => new { x.AlunoId, x.Tipo });

        builder.Property(x => x.Tipo).HasConversion<string>();

        builder.HasOne(x => x.Aluno).WithMany(x => x.TiposDeficiencia)
            .HasForeignKey(x => x.AlunoId).OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => new { x.Tipo, x.AlunoId });
    }
}
