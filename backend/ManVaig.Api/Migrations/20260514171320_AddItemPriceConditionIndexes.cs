using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ManVaig.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddItemPriceConditionIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Items_Condition",
                table: "Items",
                column: "Condition");

            migrationBuilder.CreateIndex(
                name: "IX_Items_Price",
                table: "Items",
                column: "Price");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Items_Condition",
                table: "Items");

            migrationBuilder.DropIndex(
                name: "IX_Items_Price",
                table: "Items");
        }
    }
}
