using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ManVaig.Api.Migrations
{
    /// <inheritdoc />
    public partial class SimplifyBidSystem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AllowGuestOffers",
                table: "Items");

            migrationBuilder.DropColumn(
                name: "AcceptedAt",
                table: "Bids");

            migrationBuilder.DropColumn(
                name: "FailReason",
                table: "Bids");

            migrationBuilder.DropColumn(
                name: "IsAnonymous",
                table: "Bids");

            migrationBuilder.DropColumn(
                name: "ItemTitle",
                table: "Bids");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AllowGuestOffers",
                table: "Items",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "AcceptedAt",
                table: "Bids",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FailReason",
                table: "Bids",
                type: "character varying(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsAnonymous",
                table: "Bids",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ItemTitle",
                table: "Bids",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);
        }
    }
}
