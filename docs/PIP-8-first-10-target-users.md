# PIP-8 — First 10 target users + communities

## Goal
Find the first ~10 real users who will:
- run PipelineOS locally (Docker Compose),
- connect it to a repo,
- trigger runs via GitHub webhooks,
- and give feedback on the “push commit → watch logs → pass/fail” loop.

## Ideal early adopter profile
- Maintains a small-to-medium OSS repo with CI pain (flaky tests, slow feedback loops).
- Comfortable with self-hosting (Docker Compose).
- Values transparency and control over “black box” CI services.

## First 10 target users (persona list)
These are *types of people* to target; we can replace with specific names as we do outreach.

1) OSS maintainer of a JS/TS project with flaky browser tests (Playwright/Cypress).
2) Indie SaaS founder with a monorepo and a preference for self-hosting.
3) DevTools engineer who cares about CI speed + developer experience.
4) QA/automation engineer drowning in flaky tests and retries.
5) Platform engineer at a small startup who wants minimal infrastructure overhead.
6) Open-source contributor who runs CI locally for faster iteration.
7) Team lead who wants to reduce CI noise but can’t justify enterprise CI tooling.
8) Developer advocate who likes showcasing pragmatic tooling.
9) Security-minded developer who wants on-prem CI visibility and minimal permissions.
10) Maintainer of a repo with GitHub Actions fatigue (spending, limits, complexity).

## Communities to start with (high-signal)
- GitHub repos/issues where people discuss flaky tests + retries (Playwright/Cypress/Jest ecosystems).
- Reddit: r/devops, r/programming, r/javascript (especially CI pain threads).
- Hacker News “Show HN” + comments on CI/flaky test tools.
- Discord/Slack communities for Playwright, Cypress, and testing automation.
- OSS maintainers of repos with heavy CI usage (large test suites).

## Outreach message (first draft)
Short, direct, and focused on the MVP loop:

> “I’m building a tiny self-hosted CI runner where you can push a commit and watch logs stream live in a browser (Docker Compose, GitHub webhook). If you’ve got flaky/slow CI, I’d love a 15-minute test: you run it, I watch where it breaks, and we fix it.”

## What feedback we need (Phase 1)
- Can they get it running from README without help?
- Is “runs list → run detail → live logs” intuitive?
- Are the logs fast enough and readable enough?
- What breaks in their real repo pipeline YAML?

## Success criteria
- 10 conversations / trials
- 3 users successfully run it against a real repo
- 1 user sticks around and opens issues/PRs
