using Microsoft.AspNetCore.Identity;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;

namespace TalentValley.Api.Services;

public sealed class IdentityBootstrap(
    RoleManager<IdentityRole<Guid>> roles,
    UserManager<ApplicationUser> users,
    AppDbContext database,
    IConfiguration configuration,
    IHostEnvironment environment,
    ILogger<IdentityBootstrap> logger)
{
    public async Task InitializeAsync()
    {
        foreach (var role in AppRoles.All)
        {
            if (!await roles.RoleExistsAsync(role))
            {
                var result = await roles.CreateAsync(new IdentityRole<Guid>(role));
                // A concurrent startup may have created the same role.
                if (!result.Succeeded && !await roles.RoleExistsAsync(role))
                    throw new InvalidOperationException($"Could not bootstrap role {role}.");
            }
        }

        if (!environment.IsDevelopment()) return;

        var email = configuration["BootstrapAdmin:Email"]?.Trim();
        var password = configuration["BootstrapAdmin:Password"];
        var name = configuration["BootstrapAdmin:Name"]?.Trim();
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password) || string.IsNullOrWhiteSpace(name))
        {
            logger.LogInformation("Development admin bootstrap skipped: configure BootstrapAdmin Email, Password and Name to enable it.");
            return;
        }

        var user = await users.FindByEmailAsync(email);
        if (user is not null)
        {
            // Never promote an existing non-admin account or reset an existing password.
            if (!await users.IsInRoleAsync(user, AppRoles.Admin))
                throw new InvalidOperationException("BootstrapAdmin email belongs to an existing non-admin account.");
            return;
        }

        if (name.Length > 150)
            throw new InvalidOperationException("BootstrapAdmin:Name must be at most 150 characters.");

        user = new ApplicationUser
        {
            Id = Guid.NewGuid(), UserName = email, Email = email, EmailConfirmed = true,
            NomeCompleto = name, NomeBusca = NameNormalizer.Normalize(name), CriadoEm = DateTimeOffset.UtcNow
        };
        await using var transaction = await database.Database.BeginTransactionAsync();
        var created = await users.CreateAsync(user, password);
        if (!created.Succeeded)
            throw new InvalidOperationException("Development admin creation failed. Check the configured email and password policy.");

        var assigned = await users.AddToRoleAsync(user, AppRoles.Admin);
        if (!assigned.Succeeded)
            throw new InvalidOperationException("Development admin role assignment failed.");

        await transaction.CommitAsync();

        logger.LogInformation("Development admin bootstrap completed.");
    }
}
