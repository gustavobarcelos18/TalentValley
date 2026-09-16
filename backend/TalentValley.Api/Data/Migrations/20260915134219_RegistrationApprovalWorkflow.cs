using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TalentValley.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class RegistrationApprovalWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SolicitacoesCadastro",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Tipo = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    NomeCompleto = table.Column<string>(type: "TEXT", maxLength: 150, nullable: false),
                    Email = table.Column<string>(type: "TEXT", maxLength: 254, nullable: false),
                    EmailNormalizado = table.Column<string>(type: "TEXT", maxLength: 254, nullable: false),
                    Telefone = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    Cidade = table.Column<string>(type: "TEXT", maxLength: 120, nullable: false),
                    Uf = table.Column<string>(type: "TEXT", maxLength: 2, nullable: false),
                    InstituicaoEnsino = table.Column<string>(type: "TEXT", maxLength: 180, nullable: true),
                    Curso = table.Column<string>(type: "TEXT", maxLength: 180, nullable: true),
                    TipoFormacao = table.Column<string>(type: "TEXT", nullable: true),
                    AnoConclusaoPrevisto = table.Column<int>(type: "INTEGER", nullable: true),
                    RelacaoRioPombaValley = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    Empresa = table.Column<string>(type: "TEXT", maxLength: 150, nullable: true),
                    Cargo = table.Column<string>(type: "TEXT", maxLength: 120, nullable: true),
                    SiteEmpresa = table.Column<string>(type: "TEXT", maxLength: 2048, nullable: true),
                    CriadoEm = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    AnalisadoEm = table.Column<DateTimeOffset>(type: "TEXT", nullable: true),
                    AdminUserId = table.Column<Guid>(type: "TEXT", nullable: true),
                    MotivoRejeicao = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SolicitacoesCadastro", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SolicitacoesCadastro_AspNetUsers_AdminUserId",
                        column: x => x.AdminUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesCadastro_AdminUserId",
                table: "SolicitacoesCadastro",
                column: "AdminUserId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesCadastro_EmailNormalizado",
                table: "SolicitacoesCadastro",
                column: "EmailNormalizado",
                unique: true,
                filter: "\"Status\" = 'PENDENTE'");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesCadastro_Status_Tipo_CriadoEm",
                table: "SolicitacoesCadastro",
                columns: new[] { "Status", "Tipo", "CriadoEm" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SolicitacoesCadastro");
        }
    }
}
