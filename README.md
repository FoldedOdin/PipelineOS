# PipelineOS

PipelineOS is a self-hosted CI runner + intelligence layer:

- **Ingest** GitHub webhooks (HMAC-verified) and queue runs
- **Execute** Docker-backed stages defined in `.pipelineos.yml`
- **Observe** runs via a React dashboard (runs, live logs, diagnosis, heatmaps, trends)
- **Improve** reliability with flakiness scoring + remediation rules (rule-driven retries)
- **Track** estimated per-stage cost (CPU/memory sampling)

## Prerequisites

- Docker Desktop (or Docker Engine) with Compose v2
- Node.js 20+ (for local `npm` workflows outside containers)
- GNU Make (optional). On Windows, you can run Docker Compose directly.

## Quick start

1. Copy environment templates:

   ```bash
   cp deploy/.env.example deploy/.env
   cp .env.example .env
   ```

   Edit `deploy/.env` and set strong values for:
   - `GITHUB_WEBHOOK_SECRET` (webhook HMAC secret)
   - `INTERNAL_API_KEY` (runner → API service-to-service auth)
   - `JWT_SECRET` (reserved; dashboard auth is not yet shipped)

2. Start the stack (from the repository root):

   ```bash
   make dev
   ```

   If you don’t have `make`, run:

   ```bash
   docker compose -f deploy/docker-compose.yml up --build
   ```

3. Open the dashboard at [http://localhost:3000](http://localhost:3000) and the API health check at [http://localhost:3001/health](http://localhost:3001/health).

## Services

| Service  | Port  | Role                                      |
|----------|-------|-------------------------------------------|
| mongo    | 27017 | Primary data store                        |
| api      | 3001  | REST + WebSocket (live logs)              |
| runner   | —     | Polls API, executes Docker stages         |
| frontend | 3000  | Vite + React dashboard                    |

## Key endpoints

- **Health**: `GET /health`
- **Webhook ingress**: `POST /api/webhooks/github` (expects `x-hub-signature-256`)
- **Runs**:
  - `GET /api/runs`
  - `GET /api/runs/:id`
  - `GET /api/runs/:id/stages/:stageName/logs`
  - `GET /api/runs/:id/stages/:stageName/diagnosis`
- **Analytics**:
  - `GET /api/analytics/flakiness?pipelineId=...`
  - `GET /api/analytics/flakiness-heatmap?pipelineId=...&days=7`
  - `GET /api/analytics/failure-trends?days=14`
  - `GET /api/analytics/stage-costs?pipelineId=...&days=14&limit=10`

## Configuration (high-signal)

All config is via environment variables (see `deploy/.env.example`).

- **Optional OpenAI diagnosis**
  - `OPENAI_API_KEY`
  - `OPENAI_DIAGNOSIS_URL` (optional override)
  - `OPENAI_DIAGNOSIS_MODEL` (optional override)
- **Cost estimation inputs (runner)**
  - `COST_CPU_USD_PER_CPU_SECOND` (default 0)
  - `COST_MEM_USD_PER_GB_SECOND` (default 0)

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
- Product/decision docs live under `docs/`

## Security

Please read [`SECURITY.md`](SECURITY.md) for vulnerability reporting and supported versions.

## License

Apache-2.0 — see [LICENSE](LICENSE).
