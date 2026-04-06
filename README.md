# PipelineOS (Phase 1 MVP)

Self-hosted pipeline runner with GitHub webhooks, Docker-backed stages, MongoDB history, and a minimal React dashboard.

## Prerequisites

- Docker Desktop (or Docker Engine) with Compose v2
- Node.js 20+ (for local `npm` workflows outside containers)
- GNU Make (optional; Git for Windows includes `make`)

## Quick start

1. Copy environment templates:

   ```bash
   cp deploy/.env.example deploy/.env
   cp .env.example .env
   ```

   Edit `deploy/.env` and set strong values for `GITHUB_WEBHOOK_SECRET`, `INTERNAL_API_KEY`, and `JWT_SECRET`.

2. Start the stack (from the repository root):

   ```bash
   make dev
   ```

   The Makefile runs Compose with `--project-directory .` so paths in `deploy/docker-compose.yml` resolve to this repository root (API, runner, and frontend `Dockerfile` contexts expect that layout).

3. Open the dashboard at [http://localhost:3000](http://localhost:3000) and the API health check at [http://localhost:3001/health](http://localhost:3001/health).

## Services

| Service  | Port  | Role                                      |
|----------|-------|-------------------------------------------|
| mongo    | 27017 | Primary data store                        |
| api      | 3001  | REST + WebSocket (`/ws` in later steps)   |
| runner   | —     | Polls API, executes Docker stages         |
| frontend | 3000  | Vite + React dashboard                    |

## Makefile targets

| Target         | Description                    |
|----------------|--------------------------------|
| `make dev`     | Compose up with rebuild        |
| `make dev-detached` | Compose up detached       |
| `make down`    | Compose down                   |
| `make test`    | API + runner unit tests        |
| `make lint`    | ESLint in all packages         |
| `make seed`    | Run `scripts/seed.ts`          |
| `make build`   | `docker compose build`         |
| `make logs`    | Follow Compose logs            |
| `make clean`   | Down with volumes              |

## Documentation

- [Pipeline YAML schema](docs/pipeline-schema.md)
- [Architecture](docs/architecture.md)

## License

Apache-2.0 — see [LICENSE](LICENSE).
