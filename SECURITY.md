# Security Policy

## Supported Versions

PipelineOS is currently in active development. Security fixes are provided for:

- **`master` / latest release** only

If you are running an older commit, please upgrade first.

## Reporting a Vulnerability

Please **do not** open a public GitHub Issue for security-sensitive reports.

Instead, use one of the following:

- **GitHub Private Vulnerability Reporting** (preferred), if enabled for this repository
- If private reporting is not available, contact the maintainers **privately** (e.g., a security email address listed in the repository description/website)

When reporting, include:

- A clear description of the issue and impact
- Steps to reproduce (PoC if available)
- Affected components (`api`, `runner`, `frontend`, `deploy`)
- Any relevant logs/config details **with secrets removed**

## Disclosure Process

We aim to:

- Acknowledge receipt within **7 days**
- Provide a remediation plan or fix timeline as soon as possible
- Publish a fix and release notes once the issue is resolved

## Security Notes (project-specific)

- **Secrets**: do not commit `.env` files, tokens, GitHub App private keys, or webhook secrets.
- **Webhooks**: GitHub webhook ingress validates `x-hub-signature-256` using `GITHUB_WEBHOOK_SECRET`.
- **Internal APIs**: runner ↔ API calls use `INTERNAL_API_KEY` (`x-internal-api-key` header). Treat it as a secret.

