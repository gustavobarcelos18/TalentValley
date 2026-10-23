using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TalentValley.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAlunoBusca : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AceitaMudarDeCidade",
                table: "Alunos",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "AceitaViajar",
                table: "Alunos",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "CargaHorariaSemanal",
                table: "Alunos",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ConsentimentoPcdEm",
                table: "Alunos",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "DisponivelAPartirDe",
                table: "Alunos",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "DisponivelImediatamente",
                table: "Alunos",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "InteresseVagaPcd",
                table: "Alunos",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ObjetivoProfissional",
                table: "Alunos",
                type: "character varying(280)",
                maxLength: 280,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PossuiVeiculoProprio",
                table: "Alunos",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "SouPcd",
                table: "Alunos",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "StatusBusca",
                table: "Alunos",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "StatusBuscaConfirmadoEm",
                table: "Alunos",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AlunoAreasInteresse",
                columns: table => new
                {
                    AlunoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Area = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AlunoAreasInteresse", x => new { x.AlunoId, x.Area });
                    table.ForeignKey(
                        name: "FK_AlunoAreasInteresse_Alunos_AlunoId",
                        column: x => x.AlunoId,
                        principalTable: "Alunos",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AlunoCategoriasCnh",
                columns: table => new
                {
                    AlunoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Categoria = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AlunoCategoriasCnh", x => new { x.AlunoId, x.Categoria });
                    table.ForeignKey(
                        name: "FK_AlunoCategoriasCnh_Alunos_AlunoId",
                        column: x => x.AlunoId,
                        principalTable: "Alunos",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AlunoTiposDeficiencia",
                columns: table => new
                {
                    AlunoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tipo = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AlunoTiposDeficiencia", x => new { x.AlunoId, x.Tipo });
                    table.ForeignKey(
                        name: "FK_AlunoTiposDeficiencia_Alunos_AlunoId",
                        column: x => x.AlunoId,
                        principalTable: "Alunos",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AlunoAreasInteresse_Area_AlunoId",
                table: "AlunoAreasInteresse",
                columns: new[] { "Area", "AlunoId" });

            migrationBuilder.CreateIndex(
                name: "IX_AlunoCategoriasCnh_Categoria_AlunoId",
                table: "AlunoCategoriasCnh",
                columns: new[] { "Categoria", "AlunoId" });

            migrationBuilder.CreateIndex(
                name: "IX_AlunoTiposDeficiencia_Tipo_AlunoId",
                table: "AlunoTiposDeficiencia",
                columns: new[] { "Tipo", "AlunoId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AlunoAreasInteresse");

            migrationBuilder.DropTable(
                name: "AlunoCategoriasCnh");

            migrationBuilder.DropTable(
                name: "AlunoTiposDeficiencia");

            migrationBuilder.DropColumn(
                name: "AceitaMudarDeCidade",
                table: "Alunos");

            migrationBuilder.DropColumn(
                name: "AceitaViajar",
                table: "Alunos");

            migrationBuilder.DropColumn(
                name: "CargaHorariaSemanal",
                table: "Alunos");

            migrationBuilder.DropColumn(
                name: "ConsentimentoPcdEm",
                table: "Alunos");

            migrationBuilder.DropColumn(
                name: "DisponivelAPartirDe",
                table: "Alunos");

            migrationBuilder.DropColumn(
                name: "DisponivelImediatamente",
                table: "Alunos");

            migrationBuilder.DropColumn(
                name: "InteresseVagaPcd",
                table: "Alunos");

            migrationBuilder.DropColumn(
                name: "ObjetivoProfissional",
                table: "Alunos");

            migrationBuilder.DropColumn(
                name: "PossuiVeiculoProprio",
                table: "Alunos");

            migrationBuilder.DropColumn(
                name: "SouPcd",
                table: "Alunos");

            migrationBuilder.DropColumn(
                name: "StatusBusca",
                table: "Alunos");

            migrationBuilder.DropColumn(
                name: "StatusBuscaConfirmadoEm",
                table: "Alunos");
        }
    }
}
