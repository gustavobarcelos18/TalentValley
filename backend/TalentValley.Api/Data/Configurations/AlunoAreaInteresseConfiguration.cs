using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TalentValley.Api.Domain.Entities;

namespace TalentValley.Api.Data.Configurations;

public sealed class AlunoAreaInteresseConfiguration : IEntityTypeConfiguration<AlunoAreaInteresse>
{
    public void Configure(EntityTypeBuilder<AlunoAreaInteresse> builder)
    {
        builder.HasKey(x => new { x.AlunoId, x.Area });

        builder.Property(x => x.Area).HasConversion<string>();

        builder.HasOne(x => x.Aluno).WithMany(x => x.AreasInteresse)
            .HasForeignKey(x => x.AlunoId).OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => new { x.Area, x.AlunoId });
    }
}
