using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ManVaig.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLastEmailSentAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "LastEmailSentAt",
                table: "AspNetUsers",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LastEmailSentAt",
                table: "AspNetUsers");
        }
    }
}
