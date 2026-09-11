using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TalentValley.Api.Domain.Entities;

namespace TalentValley.Api.Data.Configurations;

public sealed class ExperienciaConfiguration : IEntityTypeConfiguration<Experiencia>
{
    public void Configure(EntityTypeBuilder<Experiencia> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Empresa).IsRequired().HasMaxLength(150);

        builder.Property(x => x.Cargo).IsRequired().HasMaxLength(150);

        builder.Property(x => x.Descricao).HasMaxLength(2000);

        builder.Property(x => x.Tipo).HasConversion<string>();

        builder.HasOne(x => x.Aluno).WithMany(x => x.Experiencias)
            .HasForeignKey(x => x.AlunoId).OnDelete(DeleteBehavior.Cascade);
    }
}
