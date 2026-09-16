using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;

namespace TalentValley.Api.Data.Configurations;

public sealed class SolicitacaoCadastroConfiguration : IEntityTypeConfiguration<SolicitacaoCadastro>
{
    public void Configure(EntityTypeBuilder<SolicitacaoCadastro> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Tipo).HasConversion<string>();
        builder.Property(x => x.Status).HasConversion<string>();
        builder.Property(x => x.NomeCompleto).IsRequired().HasMaxLength(150);
        builder.Property(x => x.Email).IsRequired().HasMaxLength(254);
        builder.Property(x => x.EmailNormalizado).IsRequired().HasMaxLength(254);
        builder.Property(x => x.Telefone).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Cidade).IsRequired().HasMaxLength(120);
        builder.Property(x => x.Uf).IsRequired().HasMaxLength(2);
        builder.Property(x => x.InstituicaoEnsino).HasMaxLength(180);
        builder.Property(x => x.Curso).HasMaxLength(180);
        builder.Property(x => x.TipoFormacao).HasConversion<string>();
        builder.Property(x => x.RelacaoRioPombaValley).HasMaxLength(500);
        builder.Property(x => x.Empresa).HasMaxLength(150);
        builder.Property(x => x.Cargo).HasMaxLength(120);
        builder.Property(x => x.SiteEmpresa).HasMaxLength(2048);
        builder.Property(x => x.MotivoRejeicao).HasMaxLength(500);
        builder.HasOne(x => x.AdminUser).WithMany().HasForeignKey(x => x.AdminUserId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(x => new { x.Status, x.Tipo, x.CriadoEm });
        // SQLite partial unique index serializes concurrent public submissions for one pending email.
        builder.HasIndex(x => x.EmailNormalizado).HasFilter("\"Status\" = 'PENDENTE'").IsUnique();
    }
}
