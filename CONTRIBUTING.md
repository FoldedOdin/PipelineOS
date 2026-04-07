# Contributing to PipelineOS

Thanks for helping improve PipelineOS.

## Development setup

### Prerequisites

- Docker Desktop (Compose v2)
- Node.js 20+ (CI uses Node 24)

### One command from fresh clone

```bash
cp deploy/.env.example deploy/.env
cp .env.example .env
docker compose -f deploy/docker-compose.yml up --build
```

Then open:

- Dashboard: `http://localhost:3000`
- API health: `http://localhost:3001/health`

## Repo structure

- `api/`: Express + TypeScript API (MongoDB, webhooks, internal runner endpoints)
- `runner/`: Node runner that executes Docker stages and streams logs/metrics
- `frontend/`: React dashboard (runs, live logs, intelligence views)
- `deploy/`: Docker Compose and env templates
- `docs/`: design notes / PIPs

## Quality gates

Run these before opening a PR:

```bash
cd api && npm ci && npm run lint && npm test
cd ../runner && npm ci && npm run lint && npm test
cd ../frontend && npm ci && npm run lint && npm run build
```

## Pull request expectations

- Keep PRs focused; avoid drive-by refactors.
- Include a clear **Why this change** in the PR title or description.
- Add/update tests when changing core behavior.
- Do not commit secrets (`.env`, tokens, private keys). See `SECURITY.md`.

## Reporting bugs / feature requests

Use GitHub Issues and include:

- What you expected vs what happened
- Steps to reproduce
- Logs/screenshots (redact secrets)

