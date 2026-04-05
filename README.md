<div align="center">

# Purgr

**AI-powered developer storage cleaner for Windows, macOS & Linux**

[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](CONTRIBUTING.md)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-blue?style=flat-square)](https://tauri.app)
[![Python](https://img.shields.io/badge/python-3.12-yellow?style=flat-square)](https://python.org)
[![TypeScript](https://img.shields.io/badge/typescript-strict-blue?style=flat-square)](https://typescriptlang.org)

<br/>

> Purgr scans your developer directories, identifies stale and unused storage,
> and gives you AI-powered, confidence-scored cleanup recommendations —
> all locally, with zero telemetry.

<br/>

[Download](#installation) · [Features](#features) · [Tech Stack](#tech-stack) · [Contributing](#contributing) · [Roadmap](#roadmap)

</div>

---

## The Problem

Developer machines silently accumulate 5–50 GB of hidden storage across:

- **VS Code** — extension caches, logs, workspace storage
- **Android SDK** — old system images, unused platform versions, Gradle caches
- **Python** — pip caches, `__pycache__`, unused virtualenvs, PyTorch binaries
- **Node.js** — npm cache, dead `node_modules` from old projects

Existing tools (CCleaner, Storage Sense) have zero awareness of developer environments. Purgr is built specifically for developers.

---

## Features

-  **Smart scanning** — parallel filesystem walker across all 4 major dev tool ecosystems
- **AI-powered advisor** — natural language explanations for every recommendation
- **Safety classification** — every item scored Safe / Optional / Critical
- **Visual storage breakdown** — donut chart, size bars, per-tool breakdown
- **Natural language queries** — type *"show Android files older than 1 year"*
- **Pattern memory** — learns from your past deletion choices
- **100% local AI** — Ollama runs on your machine, no data leaves
- **Deletion audit log** — every deletion recorded in local SQLite
- **Cross-platform** — Windows, macOS, Linux, single codebase

---

## How It Works

Purgr uses a **multi-signal scoring model** (0–100) to classify each storage item:

| Signal | Max Score | Description |
|--------|-----------|-------------|
| File age | 35 pts | Days since last `mtime` modification |
| Pattern match | 95 pts | Known-safe paths (pip cache, npm cache, etc.) |
| Version obsolescence | 30 pts | Old sibling version detected (android-30 vs android-34) |
| Project activity | 20 pts | Parent project has had no recent activity |
| Process reference | 15 pts | No running process holds a handle to this directory |

**Classification thresholds:**

| Score | Classification | Action |
|-------|---------------|--------|
| 80–100 | ✅ Safe | Recommended for deletion |
| 40–79 | ⚠️ Optional | User decides, AI explains |
| 0–39 | ❌ Critical | Never delete, always blocked |

---

## Tech Stack

### Desktop Shell

| Technology | Version | Purpose |
|------------|---------|---------|
| [Tauri](https://tauri.app) | 2.x | Desktop shell (Rust + native WebView) |
| [SolidJS](https://solidjs.com) | 1.x | Frontend UI (fine-grained reactivity, no virtual DOM) |
| [TypeScript](https://typescriptlang.org) | 5.x | Strict type safety throughout |
| [Vite](https://vitejs.dev) | 5.x | Build tool and dev server |
| [UnoCSS](https://unocss.dev) | latest | Atomic CSS, on-demand, faster than Tailwind |
| [Kobalte](https://kobalte.dev) | latest | Headless accessible UI components for SolidJS |
| [TanStack Query](https://tanstack.com/query) | 5.x | Async server state management |
| [Nanostores](https://github.com/nanostores/nanostores) | latest | Global UI state (framework-agnostic, tiny) |
| [Zod](https://zod.dev) | 3.x | Runtime validation of all IPC responses |
| [@solidjs/router](https://github.com/solidjs/solid-router) | latest | Client-side routing |
| [Lucide Solid](https://lucide.dev) | latest | Icon library |

### Python Core Engine

| Technology | Version | Purpose |
|------------|---------|---------|
| [Python](https://python.org) | 3.12 | Core engine runtime |
| [FastAPI](https://fastapi.tiangolo.com) | 0.111+ | Async REST API (sidecar subprocess) |
| [Pydantic v2](https://docs.pydantic.dev) | 2.x | Strict data validation, no silent coercion |
| [SQLModel](https://sqlmodel.tiangolo.com) | latest | ORM built on SQLAlchemy 2 + Pydantic |
| [Alembic](https://alembic.sqlalchemy.org) | latest | Database migrations |
| [psutil](https://psutil.readthedocs.io) | 6.x | Cross-platform process inspection |
| [litellm](https://litellm.ai) | latest | Unified AI provider interface |
| [structlog](https://structlog.org) | latest | Structured JSON logging |
| [Dynaconf](https://dynaconf.com) | latest | Environment-aware configuration |
| [anyio](https://anyio.readthedocs.io) | latest | Async backend abstraction |

### AI Layer

| Provider | Type | Model | Cost |
|----------|------|-------|------|
| [Ollama](https://ollama.com) | Local (default) | llama3.2 / phi3 / mistral | Free, offline |
| [Anthropic Claude](https://anthropic.com) | Cloud (optional) | Claude 3.5 Haiku | API key required |
| [Google Gemini](https://ai.google.dev) | Cloud (optional) | Gemini 1.5 Flash | Free tier available |
| [Groq](https://groq.com) | Cloud (optional) | llama3-70b | Free tier available |

All providers share the same interface via **litellm** — switch with a single env variable.

### Rust (Tauri Shell)

| Technology | Purpose |
|------------|---------|
| [Tauri 2](https://tauri.app) | App shell, IPC bridge, sidecar management |
| [tracing](https://docs.rs/tracing) | Structured logging |
| Tauri Updater Plugin | Auto-update mechanism |

### Dev Tooling & Quality

| Tool | Purpose |
|------|---------|
| [Ruff](https://docs.astral.sh/ruff) | Python formatter + linter (replaces black, flake8, isort) |
| [mypy strict](https://mypy-lang.org) | Python static type checking, no `Any` allowed |
| [Prettier](https://prettier.io) | TypeScript/SolidJS formatter, enforced on commit |
| [ESLint](https://eslint.org) | TypeScript linting, strict mode |
| [Husky](https://typicode.github.io/husky) | Git pre-commit hooks |
| [lint-staged](https://github.com/lint-staged/lint-staged) | Run formatters only on staged files |
| [pytest](https://pytest.org) | Unit + integration tests |
| [pytest-asyncio](https://github.com/pytest-dev/pytest-asyncio) | Async test support |
| [Hypothesis](https://hypothesis.works) | Property-based testing for scorer |
| [Taskfile](https://taskfile.dev) | Cross-platform task runner (replaces Makefile) |
| [PyInstaller](https://pyinstaller.org) | Bundle Python sidecar into standalone binary |
| [GitHub Actions](https://github.com/features/actions) | CI on all 3 platforms + auto release |

---

## Project Structure

```
Purgr/
├── apps/
│   ├── desktop/                     # Tauri + SolidJS frontend
│   │   ├── src/
│   │   │   ├── app.tsx              # Root component + router
│   │   │   ├── routes/              # One file per route
│   │   │   │   ├── dashboard.tsx
│   │   │   │   ├── scan.tsx
│   │   │   │   ├── results.tsx
│   │   │   │   └── settings.tsx
│   │   │   ├── components/
│   │   │   │   ├── ui/              # Base design system components
│   │   │   │   ├── scan/            # Scan feature components
│   │   │   │   ├── ai/              # AI advisor components
│   │   │   │   └── layout/          # Sidebar, topbar
│   │   │   ├── stores/              # Nanostores global state
│   │   │   │   ├── scan.store.ts
│   │   │   │   ├── ui.store.ts
│   │   │   │   └── ai.store.ts
│   │   │   ├── queries/             # TanStack Query hooks
│   │   │   ├── lib/
│   │   │   │   ├── ipc.ts           # Typed Tauri invoke wrappers
│   │   │   │   ├── schemas.ts       # Zod schemas
│   │   │   │   └── utils.ts
│   │   │   └── types/
│   │   └── src-tauri/               # Rust shell
│   │       └── src/
│   │           ├── commands/        # IPC command handlers
│   │           └── main.rs
│   │
│   └── cli/                         # Optional standalone CLI
│
├── packages/
│   └── core/                        # Python engine (pip installable)
│       ├── Purgr/
│       │   ├── scanner/             # Parallel filesystem walker
│       │   ├── signals/             # Age, version, process, project signals
│       │   ├── scorer/              # 0-100 scoring engine
│       │   ├── rules/               # YAML rule loader + Pydantic models
│       │   ├── ai/                  # litellm advisor + prompt templates
│       │   ├── api/                 # FastAPI routes + middleware
│       │   ├── db/                  # SQLModel tables + Alembic migrations
│       │   └── config/              # Dynaconf settings
│       ├── tests/
│       │   ├── unit/
│       │   ├── integration/
│       │   └── property/            # Hypothesis property tests
│       └── rules/                   # YAML rule definitions
│           ├── vscode.yaml
│           ├── android.yaml
│           ├── python.yaml
│           └── node.yaml
│
└── .github/
    ├── ISSUE_TEMPLATE/
    └── workflows/
        ├── ci.yml                   # Test on Win/Mac/Linux
        ├── release.yml              # Build + publish binaries
        └── rule-lint.yml            # Validate YAML rule files
```

---

## Installation

### Download Binary (Recommended)

Download the latest release for your OS from the [Releases](../../releases) page:

- **Windows** — `Purgr_x.x.x_x64-setup.exe`
- **macOS** — `Purgr_x.x.x_x64.dmg`
- **Linux** — `Purgr_x.x.x_amd64.AppImage`

### AI Setup (Optional but Recommended)

For local AI (free, private, offline):

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.2
```

For cloud AI, set an environment variable:

```bash
export Purgr_AI_PROVIDER=claude
export ANTHROPIC_API_KEY=your_key_here
```

---

## Build From Source

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- [Rust](https://rustup.rs) (latest stable)
- [Python](https://python.org) 3.12+
- [Taskfile](https://taskfile.dev) (task runner)

### Setup

```bash
git clone https://github.com/yourusername/Purgr
cd Purgr

task setup
task dev
```

### Individual Tasks

```bash
task test          # Run all tests (Python + TypeScript)
task test:py       # Python tests only
task test:e2e      # End-to-end tests
task build         # Production build for current platform
task build:all     # Build for all platforms (requires CI)
task lint          # Run all linters
task fmt           # Format all code
```

---

## Contributing

We welcome contributions — especially new tool rule files!

### Adding support for a new dev tool

No Python knowledge needed — just add a YAML file to `packages/core/rules/`:

```yaml
name: "JetBrains IDEs"
version: "1.0"
paths:
  windows: "%APPDATA%/JetBrains"
  macos: "~/Library/Application Support/JetBrains"
  linux: "~/.config/JetBrains"
patterns:
  - pattern: "*/caches/**"
    classification: safe
    reason: "IDE index caches, rebuilt automatically on next launch"
  - pattern: "*/plugins/**"
    classification: optional
    reason: "Installed plugins, reinstallable from marketplace"
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

### Development Workflow

```bash
git checkout -b feat/your-feature
# make changes
task fmt && task lint && task test
git commit -m "feat: your feature"
gh pr create
```

---

## Roadmap

- [x] Core scanner engine (VS Code, Android SDK, Python, Node.js)
- [x] Multi-signal scoring model
- [x] YAML rule system
- [x] SQLite audit log
- [ ] Tauri desktop UI (SolidJS)
- [ ] AI advisor via Ollama
- [ ] Natural language query filter
- [ ] Pattern memory (learn from past deletions)
- [ ] JetBrains IDE support
- [ ] Docker volume cleanup
- [ ] Scheduled background scans
- [ ] CLI standalone mode
- [ ] Plugin SDK for community tool rules

---

## Code Quality Standards

- **Python** — mypy strict, Ruff formatter, no `Any`, no `print()`, structlog only
- **TypeScript** — strict mode, no `any`, no `as` casting, Prettier enforced
- **Tests** — pytest unit + integration + Hypothesis property tests
- **Comments** — zero code comments, self-documenting names only
- **File size** — max 200 lines per file, split into modules if longer
- **Separation** — scanner knows nothing about scorer, scorer knows nothing about AI

---

## Security

Purgr has filesystem access — security is taken seriously.

- No file is ever deleted without explicit user confirmation
- Every deletion is recorded in a local audit log (SQLite)
- All AI runs locally via Ollama by default — no data leaves your machine
- Cloud AI providers are opt-in only, requiring an explicit API key
- No analytics, no telemetry, no tracking of any kind

To report a vulnerability, see [SECURITY.md](SECURITY.md).

---

## License

MIT — free forever. See [LICENSE](LICENSE).

---

<div align="center">

Built with ❤️ for developers who hate mystery gigabytes

⭐ Star this repo if Purgr saved you storage!

</div>
