using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TalentValley.Api.Domain.Entities;

namespace TalentValley.Api.Data.Configurations;

public sealed class FormacaoConfiguration : IEntityTypeConfiguration<Formacao>
{
    public void Configure(EntityTypeBuilder<Formacao> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Nome).IsRequired().HasMaxLength(200);

        builder.Property(x => x.NomeBusca).IsRequired().HasMaxLength(200);

        builder.Property(x => x.Instituicao).IsRequired().HasMaxLength(200);

        builder.Property(x => x.CertificadoStorageKey).HasMaxLength(500);

        builder.Property(x => x.Tipo).HasConversion<string>();

        builder.Property(x => x.Status).HasConversion<string>();

        builder.Property(x => x.StatusValidacaoRpv).HasConversion<string>();

        builder.HasOne(x => x.Aluno).WithMany(x => x.Formacoes)
            .HasForeignKey(x => x.AlunoId).OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => x.AlunoId);

        builder.HasIndex(x => x.NomeBusca);

        builder.HasIndex(x => new { x.Tipo, x.Status });

        builder.HasIndex(x => new { x.EhRioPombaValley, x.StatusValidacaoRpv });

        builder.HasIndex(x => x.AtualizadoEm);

        builder.HasIndex(x => x.AlunoId, "IX_Formacoes_AlunoId_Principal")
            .IsUnique().HasFilter("\"Principal\" = 1");
    }
}
