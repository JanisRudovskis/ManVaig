FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY ManVaig.Api/ManVaig.Api.csproj ManVaig.Api/
RUN dotnet restore ManVaig.Api/ManVaig.Api.csproj

COPY . .
RUN dotnet publish ManVaig.Api/ManVaig.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:${PORT:-8080}

ENTRYPOINT ["dotnet", "ManVaig.Api.dll"]
