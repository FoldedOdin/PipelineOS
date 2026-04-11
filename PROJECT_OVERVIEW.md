# PipelineOS — Project Overview & Roadmap

**PipelineOS** is a self-hosted CI/CD runtime designed for solo developers and small teams who value simplicity, visibility, and control. It moves away from heavy, opaque CI platforms toward an understandable, Docker-backed execution engine with a live dashboard.

## 🚀 Current Capabilities

PipelineOS has achieved its core **Phase 1 (MVP)** milestones. It reliably handles the "push → run → observe" loop.

### 🔌 Core Execution Loop

- **GitHub Webhook Integration**: Secure HMAC-validated intake for `push` and `pull_request` events. Includes idempotency via GitHub delivery ID deduplication.
- **Docker-Backed Runner**: Executes isolated stages defined in `.pipelineos.yml`. Stages support topological dependency resolution (DAG).
- **Run Persistence**: MongoDB-backed state management for runs, individual stage statuses, and timing data.
- **GitHub YAML Fetching**: Automatically retrieves pipeline definitions from the target repository at the specific commit SHA using GitHub App authentication.

### 📊 Real-time Visibility

- **Live Log Streaming**: WebSocket-based log fan-out from the runner to the dashboard. Watch your builds happen in real-time.
- **Dashboard UI**: React-based interface for listing runs, viewing run details, and inspecting live or historical logs.

### 🧠 Intelligence & Reliability (Preview)

- **Failure Diagnosis**: Basic AI-powered root cause analysis using OpenAI (or compatible endpoints) to generate "diagnosis cards" from log errors.
- **Flakiness Scoring**: Rolling window algorithm that calculates a "flake score" per stage to identify unstable tests or procedures.
- **Auto-Remediation (Engine)**: An internal rules engine that can match failure patterns (e.g., network timeouts) and trigger automatic retries.
- **Safe Operations**:
  - **Stale Run Recovery**: Heartbeat mechanism to reclaim or fail "zombie" runs if a runner crashes.
  - **Resource Guards**: Ingestion limits for log sizes and failsafe startup configuration validation.

---

## 🛠️ Tech Stack

- **API**: Node.js, Express, TypeScript, MongoDB (Mongoose), WebSocket (ws).
- **Runner**: Node.js, Dockerode (Docker Engine API), YAML Parser.
- **Frontend**: React, Vite, Tailwind CSS.
- **Deployment**: Docker Compose for "single-click" bring-up.

---

## 🗺️ Future Roadmap

The future of PipelineOS focuses on maturing the **Intelligence** layer and the **Developer Experience (DX)**.

### 1️⃣ Intelligence & Analytics (High Priority)

- **Local AI Support**: Integration with **Ollama** for failure diagnosis to remove the OpenAI dependency and keep data 100% on-premise.
- **Remediation UI**: Create a visual "Rules Builder" in the dashboard to let users define remediation logic without touching the database directly.
- **Cost Analytics UI**: Real-time visualization of per-stage compute costs in the dashboard.
- **Flakiness Heatmaps**: Enhanced dashboard views to track stage stability over weeks/months.

### 2️⃣ Operational Maturity

- **Observability Stack**: Integration of OpenTelemetry (Trace-IDs) for deep performance debugging of the CI system itself.
- **Multi-Runner Support**: Improve the claiming logic to safely allow many runners to scale horizontally across different machines.
- **Cache Management**: Build a dedicated system for stage-level caching (e.g., `node_modules`, `vendor/`) between runs.
- **Secrets Management**: Secure, encrypted secret injection from the API to the Runner for sensitive build environment variables.

### 3️⃣ Security & Identity

- **Dashboard Auth**: Implementation of JWT-based login for the dashboard to transition from "internal-only admin" to "team-safe" visibility.
- **Fine-grained Permissions**: Scoped access tokens for runners and webhooks to maintain a Zero Trust architecture.

### 4️⃣ Extended Integration

- **GitLab / Bitbucket Support**: Abstract the webhook/fetch layer to support providers beyond GitHub.
- **Custom Notifications**: Discord/Slack/Email alerts for failed runs or auto-remediation triggers.

---

## 📝 Current Focus

We are currently polishing the **Remediation & Intelligence** dashboard views to make the underlying algorithms actionable for the end-user.
