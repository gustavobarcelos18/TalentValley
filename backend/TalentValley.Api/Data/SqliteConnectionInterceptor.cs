using System.Data.Common;
using System.Globalization;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore.Diagnostics;
using TalentValley.Api.Services;

namespace TalentValley.Api.Data;

public sealed class SqliteConnectionInterceptor : DbConnectionInterceptor
{
    // synchronous is connection-local, including when a pooled connection is reused.
    public override void ConnectionOpened(DbConnection connection, ConnectionEndEventData eventData)
    {
        RegisterMigrationFunctions(connection);
        using var command = connection.CreateCommand();
        command.CommandText = "PRAGMA synchronous=NORMAL;";
        command.ExecuteNonQuery();
    }

    public override async Task ConnectionOpenedAsync(
        DbConnection connection,
        ConnectionEndEventData eventData,
        CancellationToken cancellationToken = default)
    {
        RegisterMigrationFunctions(connection);
        await using var command = connection.CreateCommand();
        command.CommandText = "PRAGMA synchronous=NORMAL;";
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static void RegisterMigrationFunctions(DbConnection connection)
    {
        // Data backfills use the same normalization as application writes, including Unicode names.
        var sqlite = (SqliteConnection)connection;
        sqlite.CreateFunction("tv_normalize_name", (string value) => NameNormalizer.Normalize(value), isDeterministic: true);
        sqlite.CreateFunction("tv_utc_timestamp", (string value) =>
            DateTimeOffset.Parse(value, CultureInfo.InvariantCulture).UtcDateTime
                .ToString("yyyy-MM-dd HH:mm:ss.FFFFFFF", CultureInfo.InvariantCulture), isDeterministic: true);
    }
}
