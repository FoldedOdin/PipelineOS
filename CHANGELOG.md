# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-04-07

### Added

- GitHub webhook intake (HMAC validation) and queued runs persisted in MongoDB.
- Runner that fetches `.pipelineos.yml`, executes Docker stages, and streams logs back to the API.
- React dashboard for run history, run detail, and live logs.
- Intelligence layer:
  - Flakiness scoring and heatmap analytics.
  - Stage failure diagnosis (heuristics + optional OpenAI summary).
  - Remediation rules engine with rule-driven retries and effectiveness tracking.
  - Stage cost metrics (CPU/memory sampling) with cost aggregation analytics.

