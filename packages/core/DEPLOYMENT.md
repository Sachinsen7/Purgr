# Deploying `devsweep-core`

`devsweep-core` is a FastAPI service that can run locally, in Docker, or on a simple container host such as Railway, Render, or Fly.io.

## Quick start

From [packages/core](/s:/My%20Codes/Purgr/packages/core):

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -e .
$env:DEVSWEEP_API_HOST="0.0.0.0"
$env:DEVSWEEP_API_PORT="9231"
python -m devsweep.api
```

Health check:

```powershell
curl http://127.0.0.1:9231/health
```

## Environment variables

- `DEVSWEEP_API_HOST`: bind address for Uvicorn. Default: `127.0.0.1`
- `DEVSWEEP_API_PORT`: bind port. Default: `9231`
- `HOST`: fallback host used by many platforms
- `PORT`: fallback port used by many platforms
- `DEVSWEEP_LOG_LEVEL`: log level such as `INFO` or `DEBUG`
- `DEVSWEEP_OLLAMA_BASE_URL`: optional Ollama endpoint
- `DEVSWEEP_AI_MODEL`: optional Ollama model name

## Docker

Build and run from [packages/core](/s:/My%20Codes/Purgr/packages/core):

```powershell
docker build -t devsweep-core .
docker run --rm -p 9231:9231 devsweep-core
```

If you want the SQLite database to persist outside the container:

```powershell
docker run --rm -p 9231:9231 `
  -v devsweep-data:/root/.local/share/devsweep `
  devsweep-core
```

## Railway / Render / Fly.io

Use the Dockerfile in [packages/core/Dockerfile](/s:/My%20Codes/Purgr/packages/core/Dockerfile).

Recommended settings:

- Start command: leave empty if the platform uses the Dockerfile
- Health check path: `/health`
- Port: let the platform provide `PORT`
- Persistent disk: optional, but recommended if you want scan history and settings to survive restarts

## Notes

- The API supports Linux, macOS, and Windows, but some filesystem behaviors are Windows-specific. In particular, Recycle Bin deletion and some drive discovery paths are Windows-first.
- If you deploy this remotely, scan results will reflect the host machine or container filesystem, not your local developer workstation.
