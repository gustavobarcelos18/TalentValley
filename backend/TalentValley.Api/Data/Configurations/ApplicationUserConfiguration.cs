using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TalentValley.Api.Domain.Entities;

namespace TalentValley.Api.Data.Configurations;

public sealed class ApplicationUserConfiguration : IEntityTypeConfiguration<ApplicationUser>
{
    public void Configure(EntityTypeBuilder<ApplicationUser> builder)
    {
        builder.Property(x => x.NomeCompleto).IsRequired().HasMaxLength(150);

        builder.Property(x => x.NomeBusca).IsRequired().HasMaxLength(150);

        builder.HasIndex(x => x.NomeBusca);
        builder.HasIndex(x => x.NormalizedEmail).HasDatabaseName("EmailIndex").IsUnique();
    }
}
