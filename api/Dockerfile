# syntax=docker/dockerfile:1
# The image of the application api, with the built client inside it. The build context is the repository
# root, because the api embeds contracts/control-definition.schema.json and the client is built from web/:
#
#   docker build -f api/Dockerfile -t dc-api .
#
# Three stages: Node builds the Angular client, the .NET SDK publishes the api, and the ASP.NET runtime
# image receives the publish folder with the client's build as the wwwroot inside it.

FROM node:22-bookworm-slim AS web
WORKDIR /src/web
# The lock file first, so a change of source does not install the packages again.
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npx ng build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY api/Directory.Build.props api/Directory.Packages.props api/
COPY api/src/DataControls.Api/DataControls.Api.csproj api/src/DataControls.Api/
RUN dotnet restore api/src/DataControls.Api/DataControls.Api.csproj
# The project embeds the schema by its path in the repository: ../../../contracts from the project folder.
COPY contracts/control-definition.schema.json contracts/
COPY api/src/ api/src/
RUN dotnet publish api/src/DataControls.Api/DataControls.Api.csproj -c Release --no-restore -o /out

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /out ./
# The api serves the wwwroot beside it, and only one that is there when it starts.
COPY --from=web /src/web/dist/web/browser ./wwwroot
# The image's own non-root user.
USER $APP_UID
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "DataControls.Api.dll"]
