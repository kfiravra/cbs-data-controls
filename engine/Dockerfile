# syntax=docker/dockerfile:1
# The image of the control engine. The build context is the repository root, because the engine reads
# contracts/ beside engine/:
#
#   docker build -f engine/Dockerfile -t dc-engine .
#
# engine/Dockerfile.dockerignore keeps the context down to what is copied below.
# The Debian release is pinned with the Python one: Microsoft's ODBC repository is per Debian release.
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# ODBC Driver 18 for SQL Server and the driver manager, from Microsoft's package repository.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && curl -fsSL -o /tmp/packages-microsoft-prod.deb \
      https://packages.microsoft.com/config/debian/12/packages-microsoft-prod.deb \
 && dpkg -i /tmp/packages-microsoft-prod.deb \
 && rm /tmp/packages-microsoft-prod.deb \
 && apt-get update \
 && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 unixodbc \
 && apt-get purge -y --auto-remove curl \
 && rm -rf /var/lib/apt/lists/*

# The same file a from-source install uses: the locked versions with their hashes.
WORKDIR /srv/engine
COPY engine/requirements.txt ./requirements.txt
RUN python -m pip install --require-hashes -r requirements.txt

# settings.py finds contracts/ two levels above itself: /srv/engine/app/settings.py -> /srv/contracts.
COPY contracts /srv/contracts
COPY engine/app ./app

RUN useradd --system --uid 10001 --no-create-home engine
USER engine

# The driver this image installs, named so the engine does not have to look for one.
ENV ENGINE_DB_DRIVER="ODBC Driver 18 for SQL Server"
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
