# PipelineOS — Phase 1 architecture

## Overview

PipelineOS Phase 1 is a **single-tenant**, self-hosted control plane:

1. **API** (`api/`) — Express + TypeScript on port `3001`. Owns MongoDB models, GitHub webhook ingress, run CRUD, internal runner callbacks, and the WebSocket log fan-out (`/ws`).
2. **Runner** (`runner/`) — Separate Node process that polls for queued runs, fetches `.pipelineos.yml` from GitHub, executes stages via **dockerode** against the host socket, and streams logs back to the API.
3. **Frontend** (`frontend/`) — Vite + React + Tailwind dashboard for run history and live logs.
4. **MongoDB** — Single instance; no replica set required for Phase 1.

## Docker Compose layout

`deploy/docker-compose.yml` lives under `deploy/`, but **build contexts and bind mounts** refer to directories at the **repository root** (`./api`, `./runner`, `./frontend`). The root `Makefile` therefore invokes:

```bash
docker compose -f deploy/docker-compose.yml --project-directory . …
```

This matches Docker’s rule that relative `build` and `volumes` paths are resolved from the compose file’s directory unless you override the project directory as above.

## Process queue

Webhook handling enqueues asynchronous work with **BullMQ** backed by **Redis**. This keeps webhook responses under GitHub’s time budget while persisting runs safely and allowing multiple API processes/runners in later phases.

## Runner claiming

Runners claim work using a **renewable lease** stored on the run document (`claimedBy`, `claimExpiresAt`) and renewed via periodic heartbeats. This reduces race conditions and prevents long-lived zombie runs when runners crash.

## Observability

Structured logging uses **pino** in Node services. Avoid unstructured `console.log` in runtime code so log shipping remains consistent in later phases.

## Out of scope (Phase 1)

Kubernetes runners, multi-tenant auth, Prometheus/Grafana, and expanded AI-assisted diagnosis are explicitly deferred.
