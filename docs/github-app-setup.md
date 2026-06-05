# GitHub App Setup

PipelineOS can fetch `.pipelineos.yml` from the triggering repository at the exact commit SHA that created a run. This requires a GitHub App installation so the API can call the GitHub Contents API without storing a personal access token.

## 1. Create the App

In GitHub, create a new GitHub App from your account or organization settings.

Recommended settings:

| Setting | Value |
|---|---|
| GitHub App name | `PipelineOS Local` or your deployment name |
| Homepage URL | Your PipelineOS dashboard URL, for example `http://localhost:3000` |
| Webhook | Disabled for this app; PipelineOS uses repository webhooks separately |
| Repository permissions | `Contents: Read-only`, `Metadata: Read-only` |
| Account permissions | None |

After creating the app, generate a private key and download the `.pem` file.

## 2. Install the App

Install the GitHub App on every repository that should use PipelineOS. The repository must contain `.pipelineos.yml` at its root.

You need three values for `deploy/.env`:

| Variable | Where to find it |
|---|---|
| `GITHUB_APP_ID` | GitHub App settings page, shown as App ID |
| `GITHUB_APP_INSTALLATION_ID` | The numeric id in the app installation URL |
| `GITHUB_APP_PRIVATE_KEY` | Contents of the downloaded `.pem` private key |

The installation URL usually looks like:

```text
https://github.com/settings/installations/12345678
```

In that example, `12345678` is the `GITHUB_APP_INSTALLATION_ID`.

## 3. Configure PipelineOS

For Docker Compose, put the values in `deploy/.env`.

Single-line private key format:

```env
GITHUB_APP_ID=123456
GITHUB_APP_INSTALLATION_ID=12345678
GITHUB_APP_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n
```

The API accepts escaped newlines (`\n`) and converts them back to PEM newlines at runtime.

## 4. Configure Repository Webhook

The GitHub App only fetches YAML. You still need a normal repository webhook to create runs.

Repository webhook settings:

| Field | Value |
|---|---|
| Payload URL | `https://your-server:3001/api/webhooks/github` |
| Content type | `application/json` |
| Secret | Same value as `GITHUB_WEBHOOK_SECRET` in `deploy/.env` |
| Events | `Push` and `Pull requests` |

For local development, expose the API with a tunnel and use that tunnel URL as the payload URL.

## 5. Verify

Restart the stack after editing `deploy/.env`:

```bash
docker compose -f deploy/docker-compose.yml --project-directory . up --build
```

Trigger a push. The runner should claim the run, the API should fetch `.pipelineos.yml` at the commit SHA, and subsequent runs at the same SHA should use the cached YAML stored in MongoDB.

If the app variables are missing, the internal pipeline endpoint returns:

```json
{ "error": "github_app_not_configured" }
```

If `.pipelineos.yml` is missing at the commit SHA, the GitHub fetch path fails with `pipeline_yaml_not_found`, and the runner logs that it is falling back to the demo pipeline.
