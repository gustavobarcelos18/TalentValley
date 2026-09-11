using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace TalentValley.Api.Data;

public sealed class SqliteConnectionInterceptor : DbConnectionInterceptor
{
    // synchronous is connection-local, including when a pooled connection is reused.
    public override void ConnectionOpened(DbConnection connection, ConnectionEndEventData eventData)
    {
        using var command = connection.CreateCommand();
        command.CommandText = "PRAGMA synchronous=NORMAL;";
        command.ExecuteNonQuery();
    }

    public override async Task ConnectionOpenedAsync(
        DbConnection connection,
        ConnectionEndEventData eventData,
        CancellationToken cancellationToken = default)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = "PRAGMA synchronous=NORMAL;";
        await command.ExecuteNonQueryAsync(cancellationToken);
    }
}
