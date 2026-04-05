# Contributing

Thanks for helping improve Purgr.

## Ground Rules

- Be respectful and follow the [Code of Conduct](CODE_OF_CONDUCT.md)
- Prefer small, focused pull requests
- Keep changes typed, tested, and formatted
- Do not commit secrets, API keys, or personal local paths

## Project Layout

- `packages/core` contains the Python scanning engine and FastAPI sidecar
- `packages/desktop` contains the SolidJS frontend and Tauri desktop shell
- `.github/workflows` contains CI and release automation

## Local Setup

### 1. Core backend

```powershell
cd packages/core
python -m venv .venv
.venv\Scripts\activate
pip install -e .[dev]
```

Run the backend directly:

```powershell
python -m devsweep.api
```

Useful commands:

```powershell
pytest
ruff format .
ruff check .
```

### 2. Desktop frontend

```powershell
cd packages/desktop
npm install
```

Browser preview:

```powershell
npm run dev
```

Desktop app with Tauri and the managed sidecar:

```powershell
npm run tauri:dev
```

Production build:

```powershell
npm run tauri:build
```

## Pull Requests

Before opening a PR, please:

- Run relevant tests for the area you changed
- Update docs when behavior or commands change
- Keep generated or unrelated formatting churn out of the diff
- Mention any known limitations or follow-up work clearly

Suggested commit style:

- `feat: ...`
- `fix: ...`
- `docs: ...`
- `refactor: ...`
- `test: ...`

## Reporting Bugs

Please use the GitHub issue templates when possible and include:

- Expected behavior
- Actual behavior
- Reproduction steps
- Screenshots or terminal output when relevant
- OS, Python, Node, and Rust versions if build/runtime related

## Security

If you think you found a security issue, please do not open a public issue
first. Follow the instructions in [SECURITY.md](SECURITY.md).
