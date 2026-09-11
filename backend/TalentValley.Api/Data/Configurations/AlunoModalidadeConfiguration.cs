using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TalentValley.Api.Domain.Entities;

namespace TalentValley.Api.Data.Configurations;

public sealed class AlunoModalidadeConfiguration : IEntityTypeConfiguration<AlunoModalidade>
{
    public void Configure(EntityTypeBuilder<AlunoModalidade> builder)
    {
        builder.HasKey(x => new { x.AlunoId, x.Modalidade });

        builder.Property(x => x.Modalidade).HasConversion<string>();

        builder.HasOne(x => x.Aluno).WithMany(x => x.Modalidades)
            .HasForeignKey(x => x.AlunoId).OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => new { x.Modalidade, x.AlunoId });
    }
}
