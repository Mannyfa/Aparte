using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Shortlet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPropertyDetailsArrays : Migration
    {
        /// <inheritdoc />
      protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<List<string>>(
                name: "Amenities",
                table: "Properties",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'"); 

            migrationBuilder.AddColumn<List<string>>(
                name: "HouseRules",
                table: "Properties",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'"); 

            migrationBuilder.AddColumn<List<string>>(
                name: "ImageUrls",
                table: "Properties",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'"); 
        }
        
        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Amenities",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "HouseRules",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "ImageUrls",
                table: "Properties");
        }
    }
}
