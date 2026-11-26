// Backend/Shortlet.Api/Program.cs
using System.Text;
using CloudinaryDotNet;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Shortlet.Api.Hubs;
using Shortlet.Core.Interfaces;
using Shortlet.Infrastructure.Data;
using Shortlet.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------------------
// 0. Configuration aliases
// Older deployments used "PaystackSettings:*" and "CloudinarySettings:*".
// Everything in the code now reads "Paystack:*" and "Cloudinary:*"; copy the
// old names across so existing Render env vars keep working.
// ---------------------------------------------------------------------
var aliases = new Dictionary<string, string?>();
foreach (var (newKey, oldKey) in new[]
{
    ("Paystack:SecretKey", "PaystackSettings:SecretKey"),
    ("Cloudinary:CloudName", "CloudinarySettings:CloudName"),
    ("Cloudinary:ApiKey", "CloudinarySettings:ApiKey"),
    ("Cloudinary:ApiSecret", "CloudinarySettings:ApiSecret"),
})
{
    if (string.IsNullOrEmpty(builder.Configuration[newKey]) && !string.IsNullOrEmpty(builder.Configuration[oldKey]))
        aliases[newKey] = builder.Configuration[oldKey];
}
if (aliases.Count > 0) builder.Configuration.AddInMemoryCollection(aliases);

// 1. Controllers
builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSignalR();

// 2. Swagger with JWT support
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Shortlet API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "Paste your JWT (without the 'Bearer ' prefix).",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } },
            new List<string>()
        }
    });
});

// 3. Database
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is missing. Copy appsettings.example.json to appsettings.Development.json and fill it in.");
var (tunedConnectionString, dbTuning) = Shortlet.Api.Helpers.DatabaseConnection.Tune(connectionString);
builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(tunedConnectionString));

// Compress JSON responses (listings with descriptions/arrays shrink ~70–80%).
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<Microsoft.AspNetCore.ResponseCompression.BrotliCompressionProvider>();
    options.Providers.Add<Microsoft.AspNetCore.ResponseCompression.GzipCompressionProvider>();
});
builder.Services.Configure<Microsoft.AspNetCore.ResponseCompression.BrotliCompressionProviderOptions>(o => o.Level = System.IO.Compression.CompressionLevel.Fastest);

// 4. Services
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddHttpClient<IPaystackService, PaystackService>();
builder.Services.AddHttpClient(); // IHttpClientFactory for the wallet payout calls
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddSingleton<IEmailQueue, EmailQueueService>();
builder.Services.AddHostedService<EmailBackgroundWorker>();

// Money flows: refunds, caution fees, payouts, plus the worker that expires/cancels/retries on a schedule.
builder.Services.AddMemoryCache(); // bank list cache
builder.Services.AddScoped<Shortlet.Api.Services.BookingFinanceService>();
builder.Services.AddHostedService<Shortlet.Api.Services.MoneyMaintenanceWorker>();

// Notifications (live + web push), account emails, and calendar sync with Airbnb / Booking.com.
builder.Services.AddScoped<Shortlet.Api.Services.Notifier>();
builder.Services.AddScoped<Shortlet.Api.Services.AccountTokenService>();
builder.Services.AddScoped<Shortlet.Api.Services.CalendarSyncService>();
builder.Services.AddHostedService<Shortlet.Api.Services.CalendarSyncWorker>();
builder.Services.AddHttpClient(Shortlet.Api.Services.CalendarSyncService.HttpClientName, client =>
{
    client.Timeout = TimeSpan.FromSeconds(20);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("Apartey-CalendarSync/1.0");
}).ConfigurePrimaryHttpMessageHandler(Shortlet.Api.Services.CalendarSyncService.CreateSafeHandler);

// Cloudinary is created lazily so a missing config only breaks uploads, not the whole API.
builder.Services.AddSingleton(sp => new Lazy<Cloudinary>(() =>
{
    var cfg = sp.GetRequiredService<IConfiguration>();
    var cloudName = cfg["Cloudinary:CloudName"];
    var apiKey = cfg["Cloudinary:ApiKey"];
    var apiSecret = cfg["Cloudinary:ApiSecret"];
    if (string.IsNullOrEmpty(cloudName) || string.IsNullOrEmpty(apiKey) || string.IsNullOrEmpty(apiSecret))
        throw new InvalidOperationException("Cloudinary is not configured (Cloudinary:CloudName / ApiKey / ApiSecret).");
    return new Cloudinary(new Account(cloudName, apiKey, apiSecret)) { Api = { Secure = true } };
}));

// 5. JWT authentication
var jwtSettings = builder.Configuration.GetSection("Jwt");
var jwtKey = jwtSettings["Key"];
if (string.IsNullOrEmpty(jwtKey) || jwtKey.Length < 32)
    throw new InvalidOperationException("Jwt:Key is missing or shorter than 32 characters.");

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
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
    };

    // Browsers can't send headers on WebSocket connections, so SignalR passes the JWT as ?access_token=
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            if (!string.IsNullOrEmpty(accessToken) && context.HttpContext.Request.Path.StartsWithSegments("/chathub"))
                context.Token = accessToken;
            return Task.CompletedTask;
        }
    };
});

// 6. CORS (configure extra origins with Cors:AllowedOrigins)
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
allowedOrigins = allowedOrigins
    .Concat(new[] { "https://aparteyng.vercel.app", "http://localhost:5173", "http://localhost:5174" })
    .Distinct()
    .ToArray();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // required for SignalR
    });
});

var app = builder.Build();

if (dbTuning.Count > 0)
    app.Logger.LogWarning("Database connection string adjusted for performance: {Changes}. Update the configured string to match.", string.Join(", ", dbTuning));

// Open the first database connection now, so the first visitor doesn't wait for the TLS handshake.
_ = Task.Run(async () =>
{
    try
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var started = DateTime.UtcNow;
        await db.Database.ExecuteSqlRawAsync("SELECT 1");
        app.Logger.LogInformation("Database warm-up took {Ms} ms.", (int)(DateTime.UtcNow - started).TotalMilliseconds);
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex, "Database warm-up failed; the first request will open the connection instead.");
    }
});

// Render / other hosts terminate TLS in front of the app.
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

app.UseResponseCompression();

// Cheap endpoint for uptime monitors / keep-alive pings (no database access).
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.UseSwagger();
app.UseSwaggerUI();

if (app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<ChatHub>("/chathub");

app.Run();
