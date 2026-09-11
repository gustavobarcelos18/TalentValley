using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TalentValley.Api.Domain.Entities;

namespace TalentValley.Api.Data.Configurations;

public sealed class AuditoriaConfiguration : IEntityTypeConfiguration<Auditoria>
{
    public void Configure(EntityTypeBuilder<Auditoria> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.AdminEmailSnapshot).IsRequired().HasMaxLength(254);

        builder.Property(x => x.EntidadeTipo).IsRequired().HasMaxLength(100);

        builder.Property(x => x.EntidadeId).IsRequired().HasMaxLength(150);

        builder.Property(x => x.Descricao).IsRequired().HasMaxLength(500);

        builder.Property(x => x.Acao).HasConversion<string>();
        // SQLite can order UTC DateTime values in SQL; the domain retains DateTimeOffset.
        builder.Property(x => x.CriadoEm).HasConversion(
            value => value.UtcDateTime,
            value => new DateTimeOffset(DateTime.SpecifyKind(value, DateTimeKind.Utc)));

        // EntidadeId is a snapshot, never a foreign key to the audited target.
        builder.HasOne(x => x.AdminUser).WithMany()
            .HasForeignKey(x => x.AdminUserId).OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(x => x.CriadoEm);

        builder.HasIndex(x => x.AdminUserId);

        builder.HasIndex(x => x.Acao);
    }
}
