using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TalentValley.Api.Domain.Entities;

namespace TalentValley.Api.Data.Configurations;

public sealed class IdiomaConfiguration : IEntityTypeConfiguration<Idioma>
{
    public void Configure(EntityTypeBuilder<Idioma> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Nome).IsRequired().HasMaxLength(100);

        builder.Property(x => x.NomeBusca).IsRequired().HasMaxLength(100);

        builder.HasIndex(x => x.NomeBusca).IsUnique();
    }
}
