using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ManVaig.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddBidRedesign : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "AcceptedAt",
                table: "Bids",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsAnonymous",
                table: "Bids",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // Migrate Expired status: old value 2 → new value 5
            migrationBuilder.Sql("UPDATE \"Bids\" SET \"Status\" = 5 WHERE \"Status\" = 2");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AcceptedAt",
                table: "Bids");

            migrationBuilder.DropColumn(
                name: "IsAnonymous",
                table: "Bids");
        }
    }
}
