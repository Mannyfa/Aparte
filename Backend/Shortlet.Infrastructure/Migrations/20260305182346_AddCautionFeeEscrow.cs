using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Shortlet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCautionFeeEscrow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "CautionFee",
                table: "Properties",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "CautionFeeAmount",
                table: "Bookings",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "CautionFeeStatus",
                table: "Bookings",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CautionFee",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "CautionFeeAmount",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "CautionFeeStatus",
                table: "Bookings");
        }
    }
}
