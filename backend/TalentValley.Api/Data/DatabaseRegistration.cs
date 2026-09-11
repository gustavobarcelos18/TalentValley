using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace TalentValley.Api.Data;

public static class DatabaseRegistration
{
    public static IServiceCollection AddApplicationDatabase(
        this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is required.");

        var sqlite = new SqliteConnectionStringBuilder(connectionString)
        {
            // Microsoft.Data.Sqlite applies foreign_keys=ON on every connection open.
            ForeignKeys = true
        };
        sqlite.DataSource = Path.GetFullPath(sqlite.DataSource, environment.ContentRootPath);
        Directory.CreateDirectory(Path.GetDirectoryName(sqlite.DataSource)!);

        services.AddSingleton<SqliteConnectionInterceptor>();
        services.AddDbContext<AppDbContext>((provider, options) =>
            options.UseSqlite(sqlite.ToString())
                .AddInterceptors(provider.GetRequiredService<SqliteConnectionInterceptor>()));

        return services;
    }

    public static async Task InitializeSqliteAsync(AppDbContext context)
    {
        await context.Database.OpenConnectionAsync();
        try
        {
            await using var command = context.Database.GetDbConnection().CreateCommand();
            // WAL persists in the database file. Check once at startup, not on each query.
            command.CommandText = "PRAGMA journal_mode;";
            var mode = (string?)await command.ExecuteScalarAsync();
            if (!string.Equals(mode, "wal", StringComparison.OrdinalIgnoreCase))
            {
                command.CommandText = "PRAGMA journal_mode=WAL;";
                mode = (string?)await command.ExecuteScalarAsync();
                if (!string.Equals(mode, "wal", StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidOperationException("SQLite could not enable WAL mode.");
                }
            }
        }
        finally
        {
            await context.Database.CloseConnectionAsync();
        }
    }
}
