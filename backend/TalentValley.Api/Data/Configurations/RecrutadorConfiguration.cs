using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TalentValley.Api.Domain.Entities;

namespace TalentValley.Api.Data.Configurations;

public sealed class RecrutadorConfiguration : IEntityTypeConfiguration<Recrutador>
{
    public void Configure(EntityTypeBuilder<Recrutador> builder)
    {
        builder.HasKey(x => x.UserId);

        builder.Property(x => x.Empresa).IsRequired().HasMaxLength(150);
        builder.Property(x => x.EmpresaBusca).IsRequired().HasMaxLength(150);

        builder.Property(x => x.Cargo).IsRequired().HasMaxLength(120);

        builder.Property(x => x.Telefone).IsRequired().HasMaxLength(20);

        builder.Property(x => x.Cidade).IsRequired().HasMaxLength(120);

        builder.Property(x => x.Uf).IsRequired().HasMaxLength(2);

        builder.Property(x => x.Status).HasConversion<string>();

        builder.HasOne(x => x.User).WithOne()
            .HasForeignKey<Recrutador>(x => x.UserId).OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => x.Status);
    }
}
