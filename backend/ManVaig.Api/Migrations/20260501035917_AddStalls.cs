using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ManVaig.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddStalls : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Step 1: Create Stalls table
            migrationBuilder.CreateTable(
                name: "Stalls",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Slug = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    HeaderImageUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    BackgroundImageUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    AccentColor = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Stalls", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Stalls_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Stalls_UserId",
                table: "Stalls",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Stalls_UserId_Slug",
                table: "Stalls",
                columns: new[] { "UserId", "Slug" },
                unique: true);

            // Step 2: Create StallFeaturedItems table
            migrationBuilder.CreateTable(
                name: "StallFeaturedItems",
                columns: table => new
                {
                    StallId = table.Column<Guid>(type: "uuid", nullable: false),
                    ItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StallFeaturedItems", x => new { x.StallId, x.ItemId });
                    table.ForeignKey(
                        name: "FK_StallFeaturedItems_Items_ItemId",
                        column: x => x.ItemId,
                        principalTable: "Items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_StallFeaturedItems_Stalls_StallId",
                        column: x => x.StallId,
                        principalTable: "Stalls",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StallFeaturedItems_ItemId",
                table: "StallFeaturedItems",
                column: "ItemId");

            // Step 3: Add StallId to Items as NULLABLE first
            migrationBuilder.AddColumn<Guid>(
                name: "StallId",
                table: "Items",
                type: "uuid",
                nullable: true);

            // Step 4: Create a default "General" stall for each user who has items,
            // then assign all their items to that stall.
            migrationBuilder.Sql(@"
                -- Create a default stall for each user who has items
                INSERT INTO ""Stalls"" (""Id"", ""UserId"", ""Name"", ""Slug"", ""SortOrder"", ""IsDefault"", ""CreatedAt"", ""UpdatedAt"")
                SELECT
                    gen_random_uuid(),
                    ""UserId"",
                    'General',
                    'general',
                    0,
                    true,
                    NOW() AT TIME ZONE 'UTC',
                    NOW() AT TIME ZONE 'UTC'
                FROM ""Items""
                GROUP BY ""UserId"";

                -- Assign all items to their owner's default stall
                UPDATE ""Items"" i
                SET ""StallId"" = s.""Id""
                FROM ""Stalls"" s
                WHERE s.""UserId"" = i.""UserId""
                  AND s.""IsDefault"" = true;
            ");

            // Step 5: Make StallId NOT NULL now that all items have a stall
            migrationBuilder.AlterColumn<Guid>(
                name: "StallId",
                table: "Items",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            // Step 6: Add index and FK constraint
            migrationBuilder.CreateIndex(
                name: "IX_Items_StallId",
                table: "Items",
                column: "StallId");

            migrationBuilder.AddForeignKey(
                name: "FK_Items_Stalls_StallId",
                table: "Items",
                column: "StallId",
                principalTable: "Stalls",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Items_Stalls_StallId",
                table: "Items");

            migrationBuilder.DropIndex(
                name: "IX_Items_StallId",
                table: "Items");

            migrationBuilder.DropColumn(
                name: "StallId",
                table: "Items");

            migrationBuilder.DropTable(
                name: "StallFeaturedItems");

            migrationBuilder.DropTable(
                name: "Stalls");
        }
    }
}
