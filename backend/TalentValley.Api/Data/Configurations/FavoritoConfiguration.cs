using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TalentValley.Api.Domain.Entities;

namespace TalentValley.Api.Data.Configurations;

public sealed class FavoritoConfiguration : IEntityTypeConfiguration<Favorito>
{
    public void Configure(EntityTypeBuilder<Favorito> builder)
    {
        builder.HasKey(x => new { x.RecrutadorId, x.AlunoId });

        builder.HasOne(x => x.Recrutador).WithMany()
            .HasForeignKey(x => x.RecrutadorId).OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Aluno).WithMany()
            .HasForeignKey(x => x.AlunoId).OnDelete(DeleteBehavior.Cascade);
    }
}
