# 1. Use the official .NET 9 SDK image to build the app
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /app

# 2. Copy all the backend files into the container
COPY . ./

# 3. Publish the API project to a folder called "/out"
RUN dotnet publish Shortlet.Api/Shortlet.Api.csproj -c Release -o /out

# 4. Use the lightweight .NET 9 runtime image to run the app
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
COPY --from=build /out .

# 5. Tell the container to listen on Port 8080 (which Render requires)
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

# 6. Start the app!
ENTRYPOINT ["dotnet", "Shortlet.Api.dll"]