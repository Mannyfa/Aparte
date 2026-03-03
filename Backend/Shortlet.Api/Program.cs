// Backend/Shortlet.Api/Program.cs
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Shortlet.Core.Interfaces;
using Shortlet.Infrastructure.Data;
using Shortlet.Infrastructure.Services;
using Shortlet.Api.Hubs;

var builder = WebApplication.CreateBuilder(args);

// 1. Add Controllers
builder.Services.AddControllers().AddJsonOptions(options =>
{
    // This stops the infinite JSON loop!
    options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
});
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSignalR();

// 2. Configure Swagger to Support JWT Tokens
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Shortlet API", Version = "v1" });
    
    // Add the "Authorize" button to Swagger UI
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. \r\n\r\n Enter 'Bearer' [space] and then your token in the text input below.\r\n\r\nExample: \"Bearer 12345abcdef\"",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement()
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                },
                Scheme = "oauth2",
                Name = "Bearer",
                In = ParameterLocation.Header,
            },
            new List<string>()
        }
    });
});

// 3. Register Database Connection
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// 4. Register Custom Services (Dependency Injection)
builder.Services.AddScoped<IAuthService, AuthService>();

builder.Services.AddScoped<Shortlet.Core.Interfaces.Repositories.IPropertyRepository, Shortlet.Infrastructure.Repositories.PropertyRepository>();
builder.Services.AddScoped<Shortlet.Core.Interfaces.IPropertyService, Shortlet.Infrastructure.Services.PropertyService>();

builder.Services.AddHttpClient<Shortlet.Core.Interfaces.IPaystackService, Shortlet.Infrastructure.Services.PaystackService>();
builder.Services.AddScoped<Shortlet.Core.Interfaces.IBookingService, Shortlet.Infrastructure.Services.BookingService>();
builder.Services.AddScoped<Shortlet.Core.Interfaces.IEmailService, Shortlet.Infrastructure.Services.EmailService>();

// 1. Register the Email Queue as a Singleton (so the same queue is shared everywhere)
builder.Services.AddSingleton<IEmailQueue, EmailQueueService>();

// 2. Register the Background Worker as a Hosted Service
builder.Services.AddHostedService<EmailBackgroundWorker>();

// 5. Configure JWT Authentication
var jwtSettings = builder.Configuration.GetSection("Jwt");
var key = Encoding.UTF8.GetBytes(jwtSettings["Key"] ?? throw new InvalidOperationException("JWT Key is missing"));

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings["Issuer"],
        ValidAudience = jwtSettings["Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(key)
    };
});

// --- UPDATED CORS POLICY ---
// Allow our React frontend (both local and live Vercel) to talk to this API
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(
                "https://aparteyng.vercel.app", // Your live Vercel domain
                "http://localhost:5174", 
                "http://localhost:5173"
              )
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // REQUIRED for SignalR (ChatHub) to work across domains!
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
// Note: Swagger is available in Production now so you can test your live database easily.
app.UseSwagger();
app.UseSwaggerUI();

app.UseHttpsRedirection();

// IMPORTANT: Order matters here! CORS -> Auth -> Controllers
app.UseCors("AllowFrontend");

app.UseAuthentication(); // 1st: Who are you? (Validates the JWT)
app.UseAuthorization();  // 2nd: What are you allowed to do? (Checks roles)

app.MapControllers();
app.MapHub<ChatHub>("/chathub");

app.Run();