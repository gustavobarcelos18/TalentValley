using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TalentValley.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddConsentTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ConsentimentoEm",
                table: "SolicitacoesCadastro",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VersaoTermos",
                table: "SolicitacoesCadastro",
                type: "TEXT",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ConsentimentoEm",
                table: "Alunos",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VersaoTermos",
                table: "Alunos",
                type: "TEXT",
                maxLength: 20,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ConsentimentoEm",
                table: "SolicitacoesCadastro");

            migrationBuilder.DropColumn(
                name: "VersaoTermos",
                table: "SolicitacoesCadastro");

            migrationBuilder.DropColumn(
                name: "ConsentimentoEm",
                table: "Alunos");

            migrationBuilder.DropColumn(
                name: "VersaoTermos",
                table: "Alunos");
        }
    }
}
