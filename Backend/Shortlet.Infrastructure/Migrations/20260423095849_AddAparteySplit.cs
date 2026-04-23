using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Shortlet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAparteySplit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SplitGroups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BookingId = table.Column<Guid>(type: "uuid", nullable: false),
                    TotalAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    TotalShares = table.Column<int>(type: "integer", nullable: false),
                    PaidShares = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SplitGroups", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SplitGroups_Bookings_BookingId",
                        column: x => x.BookingId,
                        principalTable: "Bookings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SplitShares",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SplitGroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    PaymentReference = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SplitShares", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SplitShares_SplitGroups_SplitGroupId",
                        column: x => x.SplitGroupId,
                        principalTable: "SplitGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SplitGroups_BookingId",
                table: "SplitGroups",
                column: "BookingId");

            migrationBuilder.CreateIndex(
                name: "IX_SplitShares_SplitGroupId",
                table: "SplitShares",
                column: "SplitGroupId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SplitShares");

            migrationBuilder.DropTable(
                name: "SplitGroups");
        }
    }
}
