using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TalentValley.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemoveScheduledAccountDeletion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_ExclusaoAgendadaEm",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "ExclusaoAgendadaEm",
                table: "AspNetUsers");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ExclusaoAgendadaEm",
                table: "AspNetUsers",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_ExclusaoAgendadaEm",
                table: "AspNetUsers",
                column: "ExclusaoAgendadaEm");
        }
    }
}
