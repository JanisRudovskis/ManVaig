using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ManVaig.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddStallVisibilityAndDefaults : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "DefaultAcceptOffers",
                table: "Stalls",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "DefaultCanShip",
                table: "Stalls",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "DefaultCategoryId",
                table: "Stalls",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DefaultCondition",
                table: "Stalls",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DefaultLocation",
                table: "Stalls",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DefaultTagsJson",
                table: "Stalls",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Visibility",
                table: "Stalls",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_Stalls_DefaultCategoryId",
                table: "Stalls",
                column: "DefaultCategoryId");

            migrationBuilder.AddForeignKey(
                name: "FK_Stalls_Categories_DefaultCategoryId",
                table: "Stalls",
                column: "DefaultCategoryId",
                principalTable: "Categories",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Stalls_Categories_DefaultCategoryId",
                table: "Stalls");

            migrationBuilder.DropIndex(
                name: "IX_Stalls_DefaultCategoryId",
                table: "Stalls");

            migrationBuilder.DropColumn(
                name: "DefaultAcceptOffers",
                table: "Stalls");

            migrationBuilder.DropColumn(
                name: "DefaultCanShip",
                table: "Stalls");

            migrationBuilder.DropColumn(
                name: "DefaultCategoryId",
                table: "Stalls");

            migrationBuilder.DropColumn(
                name: "DefaultCondition",
                table: "Stalls");

            migrationBuilder.DropColumn(
                name: "DefaultLocation",
                table: "Stalls");

            migrationBuilder.DropColumn(
                name: "DefaultTagsJson",
                table: "Stalls");

            migrationBuilder.DropColumn(
                name: "Visibility",
                table: "Stalls");
        }
    }
}
