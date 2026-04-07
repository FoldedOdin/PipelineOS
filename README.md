# PipelineOS

**Self-hosted CI/CD that understands your pipelines, not just runs them.**

PipelineOS executes Docker-backed stages triggered by GitHub webhooks, then goes further:
it scores each stage for flakiness, diagnoses failures with AI, and lets you define
remediation rules that fire automatically. All observable through a live React dashboard.
No cloud lock-in. No per-seat pricing. Runs entirely on your infrastructure.

> ⚠️ **Status: Early development.** Core runner, webhooks, and dashboard are functional.
> Flakiness scoring, AI diagnosis, and cost tracking are in active development.
> Not recommended for production use yet.

---

## What it does

| Capability | How |
|---|---|
| **Run pipelines** | GitHub push/PR → HMAC-verified webhook → Docker stage execution |
| **Watch live** | WebSocket log streaming to the dashboard as stages run |
| **Score flakiness** | Rolling window algorithm per stage — flags unreliable stages automatically |
| **Diagnose failures** | AI-generated root cause cards (OpenAI or local Ollama) on every failure |
| **Auto-remediate** | Rules engine: define "if stage X fails with pattern Y, do Z" |
| **Track cost** | Per-stage CPU/memory sampling with configurable pricing |

---

## Quick start

**Prerequisites:** Docker Desktop (Compose v2), Node.js 20+

```bash
# 1. Clone and configure
git clone https://github.com/yourname/pipeline-os.git
cd pipeline-os
cp deploy/.env.example deploy/.env
cp .env.example .env
```

Open `deploy/.env` and set these three values — everything else has safe defaults:

```bash
GITHUB_WEBHOOK_SECRET=your_webhook_secret   # Must match your GitHub webhook config
INTERNAL_API_KEY=any_long_random_string     # Runner ↔ API auth
JWT_SECRET=any_long_random_string           # Reserved for future dashboard auth
```

```bash
# 2. Start everything
make dev

# No make? Use Compose directly:
docker compose -f deploy/docker-compose.yml up --build
```

```bash
# 3. Verify it's running
curl http://localhost:3001/health
```

Dashboard → [http://localhost:3000](http://localhost:3000)

---

## Connect your first repo

### Step 1 — Add a pipeline definition

Create `.pipelineos.yml` in your repo root:

```yaml
name: "My Pipeline"
on:
  - push
  - pull_request

stages:
  - name: install
    image: node:20-alpine
    run: npm ci

  - name: test
    image: node:20-alpine
    run: npm test
    depends_on:
      - install

  - name: build
    image: node:20-alpine
    run: npm run build
    depends_on:
      - test
```

Full schema reference → [`docs/pipeline-schema.md`](docs/pipeline-schema.md)

### Step 2 — Configure a GitHub webhook

In your GitHub repo: **Settings → Webhooks → Add webhook**

| Field | Value |
|---|---|
| Payload URL | `https://your-server:3001/api/webhooks/github` |
| Content type | `application/json` |
| Secret | Same value as `GITHUB_WEBHOOK_SECRET` in your `.env` |
| Events | `Push` and `Pull requests` |

Running locally? Expose port 3001 with [ngrok](https://ngrok.com): `ngrok http 3001`

### Step 3 — Push and watch

Push a commit. Open [http://localhost:3000/runs](http://localhost:3000/runs).
Your pipeline should appear within a few seconds.

---

## Services

| Service | Port | Role |
|---|---|---|
| `api` | 3001 | REST API + WebSocket log streaming |
| `runner` | — | Polls API, executes Docker stages |
| `frontend` | 3000 | React dashboard |
| `mongo` | 27017 | Primary data store |

---

## API reference

### Public
GET  /health
GET  /api/runs
GET  /api/runs/:id
GET  /api/runs/:id/stages/:stageName/logs
GET  /api/runs/:id/stages/:stageName/diagnosis

### Analytics
GET  /api/analytics/flakiness?pipelineId=owner/repo
GET  /api/analytics/flakiness-heatmap?pipelineId=owner/repo&days=7
GET  /api/analytics/failure-trends?days=14
GET  /api/analytics/stage-costs?pipelineId=owner/repo&days=14&limit=10

### Webhook ingress
POST /api/webhooks/github
Headers: x-hub-signature-256, x-github-event, x-github-delivery
Returns: 202 { runId } on accepted, 200 { ignored: true } on unsupported events

---

## Configuration

All configuration is via environment variables. See [`deploy/.env.example`](deploy/.env.example)
for the full list with descriptions.

**Required to start:**

| Variable | Description |
|---|---|
| `GITHUB_WEBHOOK_SECRET` | HMAC secret — must match GitHub webhook config |
| `INTERNAL_API_KEY` | Shared secret between runner and API |
| `JWT_SECRET` | Secret for future dashboard auth |
| `MONGODB_URI` | Set automatically in Docker Compose |

**Optional — AI failure diagnosis:**

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | — | Enables OpenAI-powered diagnosis cards |
| `OPENAI_DIAGNOSIS_MODEL` | `gpt-4o-mini` | Model override |
| `OPENAI_DIAGNOSIS_URL` | OpenAI default | Endpoint override (for Azure OpenAI etc.) |

No OpenAI key? PipelineOS still runs — diagnosis cards just won't appear.
Local model support via Ollama is on the roadmap.

**Optional — cost estimation (runner):**

| Variable | Default | Description |
|---|---|---|
| `COST_CPU_USD_PER_CPU_SECOND` | `0` | CPU cost rate |
| `COST_MEM_USD_PER_GB_SECOND` | `0` | Memory cost rate |
| `MAX_CONCURRENT_RUNS` | `3` | Max parallel pipeline runs |
| `MAX_STAGE_LOG_BYTES` | `1048576` | Log size cap per stage (1MB) |

---

## Makefile targets

```bash
make dev            # Build and start all services
make dev-detached   # Same, in the background
make down           # Stop all services
make test           # Run API + runner unit tests
make lint           # ESLint across all packages
make seed           # Seed test data into MongoDB
make build          # Build Docker images only
make logs           # Tail Compose logs
make clean          # Stop and remove volumes
```

---

## Troubleshooting

**Webhook returns `401 invalid_signature`**
The `GITHUB_WEBHOOK_SECRET` in your `.env` doesn't match GitHub's webhook secret.
They must be identical — check for trailing whitespace or newline characters in your env file.

**Runner returns `401 invalid_internal_api_key`**
The `INTERNAL_API_KEY` in `deploy/.env` must be the same value in both the `api` and `runner`
service environments. If you edited the env file after starting, restart the stack.

**Runner can't access Docker**
Confirm the Docker socket is mounted: `DOCKER_SOCKET=/var/run/docker.sock`.
On Linux, the runner container user may need to be in the `docker` group.

**No runs appearing after a push**
Check that GitHub can reach your webhook URL — look in GitHub's webhook delivery log
(Settings → Webhooks → Recent Deliveries). If running locally, confirm your ngrok tunnel
is active and points to port 3001.

**Runs stuck in `running` state**
The runner may have crashed mid-execution. Restart the stack — the API will automatically
requeue any runs that have been `running` for more than 15 minutes.

---

## Documentation

- [Pipeline YAML schema](docs/pipeline-schema.md)
- [Architecture overview](docs/architecture.md)
- [GitHub App setup](docs/github-app-setup.md) *(for fetching YAML at specific commit SHAs)*

---

## Contributing

Contributions are welcome. Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) before
opening a PR — it covers branch naming, local dev setup, and the test requirements.

Found a security issue? See [`SECURITY.md`](SECURITY.md) for responsible disclosure.

---

## License

Apache-2.0 — see [LICENSE](LICENSE).
