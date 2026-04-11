# PipelineOS — Product Requirements Document (PRD)

## 1. Executive Summary

**PipelineOS** is a self-hosted, lightweight CI/CD runtime designed to provide maximum visibility and control for solo developers and small teams. It bridges the gap between complex enterprise CI platforms (like Jenkins or GitHub Actions) and completely opaque, lock-in heavy cloud alternatives.

The core differentiator is **Understandable Intelligence**: a system that not only runs your builds in Docker but also proactively identifies flakiness, diagnoses failures using AI, and automates common remediations.

---

## 2. Target Audience

- **Solo FOSS Maintainers**: Need a simple way to run tests across repositories without cloud seat costs.
- **Indie Developers**: Value data sovereignty and the ability to debug their CI runner locally.
- **Small Lean Teams**: Want a "push to see logs" experience with added intelligence layers for test stability.

---

## 3. Product Vision

Move CI/CD from a "black box" that returns a green checkmark to an **active collaborator** that:

1.  **Observes**: Streams logs in real-time via WebSockets.
2.  **Analyzes**: Scores stage stability and identifies failure patterns.
3.  **Explains**: Uses AI to tell you _why_ a build failed, not just _that_ it failed.
4.  **Fixes**: Automatically retries transient failures based on user-defined rules.

---

## 4. Technical Stack & Languages

PipelineOS is built using a modern **TypeScript-first** architecture to ensure type safety across the entire monorepo.

### 💻 Languages & Runtimes

- **Runtime**: Node.js (v20+)
- **Language**: **TypeScript** (Strict mode) — Used across API, Runner, and Frontend for shared types and contracts.
- **Configuration**: **YAML** — For pipeline definitions (`.pipelineos.yml`).
- **Styling**: **CSS (Tailwind CSS)** — For the React dashboard.
- **Containerization**: **Docker (Engine API)** — For stage execution.

### 🏗️ Architecture Component Breakdown

| Component        | Tech Stack                                    | Role                                                                         |
| ---------------- | --------------------------------------------- | ---------------------------------------------------------------------------- |
| **API Server**   | Node.js, Express, Mongoose, `ws` (WebSockets) | The "Control Plane". Manages state, webhooks, and log fan-out.               |
| **Runner Agent** | Node.js, Dockerode, `yaml`                    | The "Data Plane". Claims jobs, spawns Docker containers, and streams output. |
| **Dashboard**    | React 19, Vite, Tailwind CSS                  | The "UI Layer". Real-time visualization of runs and intelligence metrics.    |
| **Database**     | MongoDB                                       | Persistent store for runs, logs (capped), and remediation rules.             |

---

## 5. Functional Requirements (Phase 1)

### 5.1 Pipeline Execution

- **YAML Definition**: Support for a `.pipelineos.yml` file in the repo root defining `stages`, `images`, and `run` commands.
- **DAG Resolution**: Topological sorting of stages based on the `depends_on` field.
- **Isolation**: Every stage must run in a clean, ephemeral Docker container.

### 5.2 Webhook Intake

- **GitHub Support**: Handle `push` and `pull_request` events.
- **Security**: Mandatory HMAC signature verification using a shared secret.
- **Idempotency**: Retried webhook deliveries must not trigger duplicate runs.

### 5.3 Real-time Observation

- **WebSocket Streaming**: Runner must pipe stdout/stderr to the API, which broadcasts to connected UI clients.
- **Log Retention**: Configurable limits on log size per stage to prevent database exhaustion.

### 5.4 Intelligence Features

- **Flakiness Detection**: Algorithm to calculate a 0-1 stability score based on a rolling window of recent outcomes.
- **AI Diagnosis**: Integration with LLMs (OpenAI/Ollama) to extract error hints and suggest fixes.
- **Remediation Engine**: Support for "Retry Rules" based on regex or status code matching.

---

## 6. Non-Functional Requirements

- **Self-Hostability**: Must be deployable via a single `docker-compose.yml`.
- **Zero-Trust Internal Communication**: Internal endpoints secured via `INTERNAL_API_KEY`.
- **Graceful Shutdown**: Handlers for `SIGTERM` to ensure in-flight runs are heartbeated or marked stale correctly.
- **Observability**: Structured JSON logging using `pino` for easier debugging.

---

## 7. Roadmap (Post-v0.1.0)

1.  **Ollama Integration**: 100% on-prem AI diagnosis.
2.  **Visual Rules Builder**: Admin UI to manage remediation logic.
3.  **Horizontal Scale**: Support for multiple runners on different host machines.
4.  **Secrets Management**: Encrypted env-variable injection for sensitive builds.
