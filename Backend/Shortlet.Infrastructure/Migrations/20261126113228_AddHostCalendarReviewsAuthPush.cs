using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Shortlet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddHostCalendarReviewsAuthPush : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PropertyCalendars_PropertyId",
                table: "PropertyCalendars");

            migrationBuilder.AddColumn<bool>(
                name: "EmailConfirmed",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ExternalUid",
                table: "PropertyCalendars",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "FeedId",
                table: "PropertyCalendars",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Note",
                table: "PropertyCalendars",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "PropertyCalendars",
                type: "text",
                nullable: false,
                defaultValue: "booking");

            migrationBuilder.AddColumn<string>(
                name: "CalendarToken",
                table: "Properties",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CalendarFeeds",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PropertyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Url = table.Column<string>(type: "text", nullable: false),
                    LastSyncedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastError = table.Column<string>(type: "text", nullable: true),
                    EventCount = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalendarFeeds", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PushSubscriptions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Endpoint = table.Column<string>(type: "text", nullable: false),
                    P256dh = table.Column<string>(type: "text", nullable: false),
                    Auth = table.Column<string>(type: "text", nullable: false),
                    UserAgent = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PushSubscriptions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UserTokens",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Purpose = table.Column<string>(type: "text", nullable: false),
                    TokenHash = table.Column<string>(type: "text", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UsedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserTokens", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PropertyCalendars_FeedId",
                table: "PropertyCalendars",
                column: "FeedId");

            migrationBuilder.CreateIndex(
                name: "IX_PropertyCalendars_PropertyId_EndDate",
                table: "PropertyCalendars",
                columns: new[] { "PropertyId", "EndDate" });

            migrationBuilder.CreateIndex(
                name: "IX_Properties_CalendarToken",
                table: "Properties",
                column: "CalendarToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CalendarFeeds_PropertyId",
                table: "CalendarFeeds",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_PushSubscriptions_Endpoint",
                table: "PushSubscriptions",
                column: "Endpoint",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PushSubscriptions_UserId",
                table: "PushSubscriptions",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_UserTokens_TokenHash",
                table: "UserTokens",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserTokens_UserId_Purpose",
                table: "UserTokens",
                columns: new[] { "UserId", "Purpose" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CalendarFeeds");

            migrationBuilder.DropTable(
                name: "PushSubscriptions");

            migrationBuilder.DropTable(
                name: "UserTokens");

            migrationBuilder.DropIndex(
                name: "IX_PropertyCalendars_FeedId",
                table: "PropertyCalendars");

            migrationBuilder.DropIndex(
                name: "IX_PropertyCalendars_PropertyId_EndDate",
                table: "PropertyCalendars");

            migrationBuilder.DropIndex(
                name: "IX_Properties_CalendarToken",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "EmailConfirmed",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ExternalUid",
                table: "PropertyCalendars");

            migrationBuilder.DropColumn(
                name: "FeedId",
                table: "PropertyCalendars");

            migrationBuilder.DropColumn(
                name: "Note",
                table: "PropertyCalendars");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "PropertyCalendars");

            migrationBuilder.DropColumn(
                name: "CalendarToken",
                table: "Properties");

            migrationBuilder.CreateIndex(
                name: "IX_PropertyCalendars_PropertyId",
                table: "PropertyCalendars",
                column: "PropertyId");
        }
    }
}
