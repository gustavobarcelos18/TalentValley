using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TalentValley.Api.Domain.Entities;

namespace TalentValley.Api.Data.Configurations;

public sealed class AlunoCategoriaCnhConfiguration : IEntityTypeConfiguration<AlunoCategoriaCnh>
{
    public void Configure(EntityTypeBuilder<AlunoCategoriaCnh> builder)
    {
        builder.HasKey(x => new { x.AlunoId, x.Categoria });

        builder.Property(x => x.Categoria).HasConversion<string>();

        builder.HasOne(x => x.Aluno).WithMany(x => x.CategoriasCnh)
            .HasForeignKey(x => x.AlunoId).OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => new { x.Categoria, x.AlunoId });
    }
}
