using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ManVaig.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddComposablePricing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Add AcceptOffers column (default false)
            migrationBuilder.AddColumn<bool>(
                name: "AcceptOffers",
                table: "Items",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // 2. Rename columns (metadata-only in Postgres, no data rewrite)
            migrationBuilder.RenameColumn(
                name: "MinBidPrice",
                table: "Items",
                newName: "MinOfferPrice");

            migrationBuilder.RenameColumn(
                name: "BidStep",
                table: "Items",
                newName: "OfferStep");

            migrationBuilder.RenameColumn(
                name: "AuctionEnd",
                table: "Items",
                newName: "EndDate");

            // 3. Migrate data: set AcceptOffers based on old PricingType
            //    Fixed=0 → false, FixedOffers=1 → true, Bidding=2 → true, Auction=3 → true
            migrationBuilder.Sql("""
                UPDATE "Items" SET "AcceptOffers" = true WHERE "PricingType" IN (1, 2, 3);
                """);

            // 4. Drop PricingType column (no longer needed)
            migrationBuilder.DropColumn(
                name: "PricingType",
                table: "Items");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Re-add PricingType with default Fixed=0
            migrationBuilder.AddColumn<int>(
                name: "PricingType",
                table: "Items",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Reverse data migration: derive PricingType from new fields
            migrationBuilder.Sql("""
                UPDATE "Items" SET "PricingType" = CASE
                    WHEN "AcceptOffers" = false THEN 0
                    WHEN "AcceptOffers" = true AND "EndDate" IS NOT NULL THEN 3
                    WHEN "AcceptOffers" = true AND "Price" IS NOT NULL THEN 1
                    ELSE 2
                END;
                """);

            migrationBuilder.DropColumn(
                name: "AcceptOffers",
                table: "Items");

            migrationBuilder.RenameColumn(
                name: "MinOfferPrice",
                table: "Items",
                newName: "MinBidPrice");

            migrationBuilder.RenameColumn(
                name: "OfferStep",
                table: "Items",
                newName: "BidStep");

            migrationBuilder.RenameColumn(
                name: "EndDate",
                table: "Items",
                newName: "AuctionEnd");
        }
    }
}
