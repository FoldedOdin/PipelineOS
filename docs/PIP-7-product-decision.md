## PIP-7 — Product decision (one page)

### What PipelineOS is
PipelineOS is a **self-hosted CI/CD runtime** for small teams and solo developers that want “push a commit → see logs → get a green/red result” without adopting a full CI platform.

### The core promise (MVP)
In a browser, a non-technical user can:
- Open PipelineOS in a web UI
- See a list of recent runs
- Click a run
- Watch **live logs scroll** for each stage as the runner executes containers

If that loop works reliably, PipelineOS is an MVP. If it doesn’t, everything else is secondary.

### Target user (Phase 1)
- Solo FOSS maintainer / indie dev
- Small team that wants a lightweight, inspectable build runner
- Values simplicity, self-hosting, and “works on my machine” deployment (Docker Compose)

### Non-goals (Phase 1)
- Multi-tenant SaaS
- Fine-grained user auth and RBAC
- Enterprise compliance, mTLS, or deep observability stacks
- Complex workflow DSLs, matrix builds, or large-scale concurrency

### Opinionated scope boundaries
- **Pipeline definition**: a single `.pipelineos.yml` at repo root.
- **Execution model**: stages run in Docker containers with `image` + shell `run`.
- **Triggers**: GitHub `push` and `pull_request` webhooks.
- **State**: MongoDB stores runs, stage status, and a bounded amount of logs.
- **Realtime UX**: WebSocket streaming of runner log chunks to the UI.

### Why this exists (the differentiator)
Most CI systems are either:
- Too heavy (complex setup, opaque behavior, lots of moving parts), or
- Too limited (no visibility, no control over runtime, hard to self-host)

PipelineOS aims to be:
- **Understandable**: the codebase and data model are simple enough to reason about.
- **Controllable**: you can run it locally with Compose and inspect the DB.
- **Visible**: you can watch a run happen in real time via live logs.

### Success criteria for Phase 1
- A GitHub webhook reliably creates exactly one queued run per delivery (idempotent).
- A runner reliably claims work, heartbeats, and marks stale runs as failed.
- Logs are streamed live and stored with sane limits.
- A newcomer can follow the README, run the stack, and see it working.

### Quality bar (Phase 1)
Priority order:
1) Security (no secrets in git, validate inbound webhooks)
2) Correctness (idempotent webhooks, no zombie runs, bounded logs)
3) Maintainability (simple types, small functions, clear modules)
4) Performance (good enough for small scale)
5) Convenience (nice-to-have tooling)

