using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TalentValley.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddLattesUrl : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LattesUrl",
                table: "Alunos",
                type: "character varying(2048)",
                maxLength: 2048,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LattesUrl",
                table: "Alunos");
        }
    }
}
