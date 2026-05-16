using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ManVaig.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddBidDenyAndNotificationReason : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DenyReason",
                table: "Notifications",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeniedAt",
                table: "Bids",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DenyDetail",
                table: "Bids",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DenyReason",
                table: "Bids",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DenyReason",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "DeniedAt",
                table: "Bids");

            migrationBuilder.DropColumn(
                name: "DenyDetail",
                table: "Bids");

            migrationBuilder.DropColumn(
                name: "DenyReason",
                table: "Bids");
        }
    }
}
