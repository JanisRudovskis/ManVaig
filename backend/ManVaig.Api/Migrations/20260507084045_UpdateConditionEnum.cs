using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ManVaig.Api.Migrations
{
    /// <inheritdoc />
    public partial class UpdateConditionEnum : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Old enum: New=0, Used=1, Worn=2
            // New enum: New=0, LikeNew=1, Good=2, Fair=3, Poor=4
            // Migration: Used(1) → Good(2), Worn(2) → Poor(4)
            // Must update Worn first (2→4) before Used (1→2) to avoid collision
            migrationBuilder.Sql("UPDATE \"Items\" SET \"Condition\" = 4 WHERE \"Condition\" = 2;"); // Worn → Poor
            migrationBuilder.Sql("UPDATE \"Items\" SET \"Condition\" = 2 WHERE \"Condition\" = 1;"); // Used → Good
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Reverse: Good(2) → Used(1), Poor(4) → Worn(2)
            migrationBuilder.Sql("UPDATE \"Items\" SET \"Condition\" = 1 WHERE \"Condition\" = 2;"); // Good → Used
            migrationBuilder.Sql("UPDATE \"Items\" SET \"Condition\" = 2 WHERE \"Condition\" = 4;"); // Poor → Worn
            // LikeNew(1) and Fair(3) have no old equivalent — map to Used(1)
            migrationBuilder.Sql("UPDATE \"Items\" SET \"Condition\" = 1 WHERE \"Condition\" = 3;"); // Fair → Used
        }
    }
}
