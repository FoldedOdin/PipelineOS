# PipelineOS — Progress Diary (Living Log)

This document is a **project diary** capturing what’s been implemented and verified so far, plus what remains.  
It intentionally contains **no secrets** (no keys/tokens/private PEMs/webhook secrets).

## 2026-04 — Initial bring-up + core execution loop

### Repo + local environment

- **Monorepo structure confirmed**: `api/`, `runner/`, `frontend/`, `deploy/`, `scripts/`.
- **Windows-friendly dev workflow**: when `make` isn’t available, use Docker Compose directly via `deploy/docker-compose.yml`.
- **Env files created** (ignored by git): root `.env` and `deploy/.env` derived from examples.

### API: run persistence + public run APIs

- Implemented a persistence layer for runs in MongoDB (`runService`).
- Implemented REST endpoints:
  - `GET /api/runs` (paged list)
  - `GET /api/runs/:id` (single run)
  - `GET /api/runs/:id/stages/:stageName/logs` (stage log fetch)
- Verified behavior: endpoints return expected HTTP codes (including 404s) and payloads; paging uses a stable sort (newest first).

### API: GitHub webhooks intake (secure-by-default)

- Added raw-body capture in Express so HMAC signatures can be validated reliably.
- Implemented **GitHub webhook HMAC validation** middleware (timing-safe comparison).
- Implemented webhook route:
  - `POST /api/webhooks/github` validates signature, quickly returns `202`, and enqueues processing.
- Implemented async webhook processing to create **queued** `Run` documents in MongoDB.

### API: internal runner endpoints (service-to-service auth)

- Added internal auth middleware using `INTERNAL_API_KEY` (`x-internal-api-key` header).
- Implemented internal endpoints for the runner under `/internal`:
  - Claim queued runs (oldest-first)
  - Update run status
  - Upsert stage metadata
  - Update stage status (duration, exit code)
  - Append stage logs

### Runner: YAML parsing + dependency resolution + Docker execution

- Added runner-side typed schema for `.pipelineos.yml` (stages, triggers, env, timeouts).
- Implemented YAML parsing + validation (strict `unknown` handling).
- Implemented topological sorting of stages (cycle detection).
- Implemented the main runner loop:
  - Polls/claims queued runs
  - Fetches pipeline definition (YAML or fallback demo)
  - Executes each stage in a Docker container (`image` + `sh -lc` command)
  - Streams logs back to the API, updates stage/run status
- Added safeguards to avoid overlapping polling ticks and to improve error handling/logging.

### GitHub YAML fetching (real pipelines)

- Implemented GitHub App-based fetch of `.pipelineos.yml` at a specific **commit SHA** using:
  - App JWT (RS256)
  - Installation access token exchange
  - GitHub Contents API to fetch `.pipelineos.yml` at `ref=<sha>`
- Added MongoDB caching for pipeline YAML keyed by:
  - `pipelineId` (format: `owner/repo`)
  - `refSha` (commit SHA)
- Updated internal pipeline fetch route to require `ref` query parameter and to:
  - return cached YAML when available
  - otherwise fetch from GitHub when GitHub App env is configured
  - otherwise return a clear `501 github_app_not_configured`
- Added an internal seeding endpoint for development to seed YAML into MongoDB (without GitHub calls).

### PIP-13 — Live logs MVP (WebSocket + real dashboard wiring)

- Implemented a real WebSocket server on the API:
  - `ws://<host>/ws/runs/:runId`
- Runner/API log fan-out:
  - When the runner appends logs via `POST /internal/runs/:id/stages/:stageName/logs`, the API now **broadcasts** structured log events to connected WebSocket clients for that run.
- Frontend:
  - `useLogStream` now parses structured JSON events and renders **scrolling live logs**.
  - Runs list and run detail screens are wired to real API payloads so a user can click into a run and then open live logs.

### PIP-24 — Webhook idempotency

- Added dedupe on GitHub delivery id (`x-github-delivery`) so retries do not create duplicate runs.

### PIP-26 — Graceful shutdown + stale run recovery

- Added runner heartbeats:
  - runner periodically calls `POST /internal/runs/:id/heartbeat` while executing a run.
- Added stale run recovery loop in the API:
  - if a run is `running` but hasn’t heartbeated recently, it gets marked `failed` to avoid “zombie” runs.
- Added graceful shutdown handlers for both API and runner (SIGTERM/SIGINT), with timeouts.

### PIP-27 — Log size limits

- Added caps for:
  - **per-chunk log ingestion** (truncate overly large log posts)
  - **total stored logs per stage** (retain the tail only)

### PIP-25 — Config validation

- Added fail-fast startup validation for required environment variables and placeholder detection (API + runner).

## Current working state (what should work now)

### Works end-to-end (with seeded YAML or demo fallback)

- Webhook creates a queued run.
- Runner claims it and executes stages via Docker.
- API stores status and logs.
- UI/API endpoints can list runs, open run details, and fetch stored logs.
- UI can open live logs and watch log lines stream via WebSocket (when a run is active).

### Works with GitHub YAML if GitHub App is configured correctly

- When a run contains `pipelineId=owner/repo` and `commitSha=<sha>`, the runner can ask the API for:
  - `.pipelineos.yml` from GitHub at that commit SHA
  - cached after first fetch

## What to do next (future work)

### Priority order (solo FOSS)

This project should bias toward **shipping a visible, usable MVP**, then fixing the correctness traps that would make it feel broken.

### 1) UX-first MVP closure (PIP-13)

- Live log streaming in-browser (WebSocket) so a non-technical user can push a commit and watch logs scroll.
- Dashboard “happy path” polish: runs list → run detail → live logs.

### 2) Correctness bugs to fix immediately after UX (PIP-24, PIP-26)

- Webhook idempotency (dedupe retries safely).
- Graceful shutdown + stale run recovery to avoid zombie runs.

### 3) Safety rails before release (PIP-27, PIP-25)

- Log size limits (prevent noisy stages from exhausting MongoDB).
- Config validation at startup (fail fast with actionable errors).

### 4) GitHub YAML as the default path (after Phase 1 is solid)

- Make GitHub YAML fetch the default behavior (with caching), with a clear runbook for GitHub App setup.

### 5) Phase 2 concerns (don’t block shipping)

- Observability (Trace-IDs, metrics) once users exist.
- Stronger service-to-service auth (mTLS/JWT) once operational needs justify it.

### 2026-04-07 — v0.1.0 release

- Tagged **`v0.1.0`** and published a **GitHub Release** with notes aligned to `CHANGELOG.md` (`[0.1.0] - 2026-04-07`): [github.com/FoldedOdin/PipelineOS/releases/tag/v0.1.0](https://github.com/FoldedOdin/PipelineOS/releases/tag/v0.1.0).
- Pre-release verification: CI green on `master`; local gates passed (`api` / `runner` / `frontend`: `npm ci`, lint, tests/build).
- **`docs/RELEASE_CHECKLIST_v0.1.0.md`** is now **gitignored** (personal/local checklist only; do not commit secrets or one-off release notes there).

## Notes / conventions

- `pipelineId` format: `owner/repo`
- Pipeline file location: `.pipelineos.yml` in repo root
- Runner executes stages using Docker images and shell commands inside containers.
