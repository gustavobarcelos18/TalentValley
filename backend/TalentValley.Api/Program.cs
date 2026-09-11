using Microsoft.AspNetCore.Identity;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddApplicationDatabase(builder.Configuration, builder.Environment);
builder.Services.AddDataProtection();
builder.Services.AddIdentityCore<ApplicationUser>()
    .AddRoles<IdentityRole<Guid>>()
    .AddEntityFrameworkStores<AppDbContext>()
    .AddDefaultTokenProviders();

var app = builder.Build();

await using (var scope = app.Services.CreateAsyncScope())
{
    // Schema changes are applied explicitly with dotnet ef, never during startup.
    await DatabaseRegistration.InitializeSqliteAsync(scope.ServiceProvider.GetRequiredService<AppDbContext>());
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.MapControllers();

app.Run();
