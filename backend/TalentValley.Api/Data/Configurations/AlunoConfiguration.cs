using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TalentValley.Api.Domain.Entities;

namespace TalentValley.Api.Data.Configurations;

public sealed class AlunoConfiguration : IEntityTypeConfiguration<Aluno>
{
    public void Configure(EntityTypeBuilder<Aluno> builder)
    {
        builder.HasKey(x => x.UserId);

        builder.Property(x => x.Slug).IsRequired().HasMaxLength(180);

        builder.Property(x => x.FotoStorageKey).HasMaxLength(500);

        builder.Property(x => x.Cidade).HasMaxLength(120);

        builder.Property(x => x.Uf).HasMaxLength(2);

        builder.Property(x => x.Telefone).HasMaxLength(20);

        builder.Property(x => x.EmailProfissional).HasMaxLength(254);

        builder.Property(x => x.LinkedInUrl).HasMaxLength(2048);

        builder.Property(x => x.GitHubUrl).HasMaxLength(2048);

        builder.Property(x => x.PortfolioUrl).HasMaxLength(2048);

        builder.Property(x => x.Bio).HasMaxLength(1500);

        builder.Property(x => x.CurriculoStorageKey).HasMaxLength(500);

        // Account deletion must explicitly remove the profile and its owned data first.
        builder.HasOne(x => x.User).WithOne()
            .HasForeignKey<Aluno>(x => x.UserId).OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => x.Slug).IsUnique();

        builder.HasIndex(x => new { x.Uf, x.Cidade });

        builder.HasIndex(x => x.AtualizadoEm);
    }
}
