# PIP-6 — Competitive analysis (CI flakiness & test intelligence)

## TL;DR
PipelineOS should **not** try to match competitors’ full “flakiness intelligence platforms” in Phase 1. The wedge is a **self-hosted runner + live logs UX** with a roadmap to “flaky detection + diagnosis” once there’s real usage.

## Competitors (snapshot)

### Trunk — Flaky Tests
- **Positioning**: a dedicated “Flaky Tests” product for detecting and managing flaky tests across CI. [Flaky Tests | Trunk](https://trunk.io/flaky-tests)
- **Signals/features called out publicly**: detection + quarantine/management workflows and reporting/analytics. [Flaky Tests | Trunk](https://trunk.io/flaky-tests)
- **Public maturity**: Trunk’s blog has announcements about Flaky Tests moving beyond beta and evolving over time. [Trunk Flaky Tests is out of beta | Trunk](https://trunk.io/blog/trunk-flaky-tests-is-out-of-beta)

### BuildPulse — Flaky Tests + Runners
- **Positioning**: two products: CI runner infra (“Runners”) and “Flaky Tests” detection/management. [BuildPulse: Run GitHub Actions 2x faster, at half cost. Flaky test detection.](https://buildpulse.io/)
- **Flaky tests product**: marketing page focuses on detection + quarantine + fixing workflows. [Find, Quarantine, and Fix Flaky Tests Instantly](https://buildpulse.io/products/flaky-tests)
- **Pricing is explicit**: multiple tiers including free and paid plans. [Simple, Reliable Pricing | BuildPulse](https://buildpulse.io/pricing)

### Currents.dev — Playwright dashboard (+ flaky test reporting)
- **Positioning**: a Playwright-focused dashboard with analytics and debugging artifacts. [Currents | Playwright Dashboard](https://currents.dev/playwright)
- **Flaky detection**: docs describe flaky tests being detected/marked when retries are enabled and supported reporting/filters. [Flaky Tests | Currents Documentation](https://docs.currents.dev/dashboard/tests/flaky-tests)

### Flaky.dev
- I was **not able to find an authoritative product source** for `flaky.dev` via web search in this pass, so I’m not including claims about it here.

## What these competitors are doing well (patterns to learn)
- **Quarantine / “don’t block devs” workflows**: keep CI green while still tracking instability. [Flaky Tests | Trunk](https://trunk.io/flaky-tests), [Find, Quarantine, and Fix Flaky Tests Instantly](https://buildpulse.io/products/flaky-tests)
- **Developer-facing surfacing**: PR comments, dashboards, badges, “top flaky tests” views. [Flaky Tests | Currents Documentation](https://docs.currents.dev/dashboard/tests/flaky-tests)
- **Business model clarity**: pricing and value framing are crisp and measurable (time/cost saved). [Simple, Reliable Pricing | BuildPulse](https://buildpulse.io/pricing)

## PipelineOS wedge (what we should do differently)
- **Self-hosted first**: a Compose-friendly, inspectable system that’s easy to run and reason about.
- **Visibility-first**: live logs + run timeline as the Phase 1 “aha”.
- **Intelligence later**: flakiness scoring/diagnosis becomes Phase 2+ once real traces/logs exist to learn from.

## Immediate recommendations for PipelineOS (actionable)
- Keep Phase 1 scope on: runner reliability + log streaming UX (already shipped).
- For Phase 2, adopt competitor patterns explicitly:
  - A quarantine mechanism (policy-driven)
  - A flaky score per test/stage over rolling windows
  - A “diagnosis card” UI for top offenders

## Sources
- [Flaky Tests | Trunk](https://trunk.io/flaky-tests)
- [Trunk Flaky Tests is out of beta | Trunk](https://trunk.io/blog/trunk-flaky-tests-is-out-of-beta)
- [BuildPulse: Run GitHub Actions 2x faster, at half cost. Flaky test detection.](https://buildpulse.io/)
- [Find, Quarantine, and Fix Flaky Tests Instantly](https://buildpulse.io/products/flaky-tests)
- [Simple, Reliable Pricing | BuildPulse](https://buildpulse.io/pricing)
- [Currents | Playwright Dashboard](https://currents.dev/playwright)
- [Flaky Tests | Currents Documentation](https://docs.currents.dev/dashboard/tests/flaky-tests)
