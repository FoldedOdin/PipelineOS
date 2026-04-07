## v0.1.0 release checklist

- **Docs**
  - [ ] README is accurate and runnable from fresh clone
  - [ ] `SECURITY.md` exists and is linked from README
  - [ ] `CONTRIBUTING.md` exists and is linked (optional)
  - [ ] `CHANGELOG.md` contains `[0.1.0]`

- **Quality gates**
  - [ ] CI green on `master`
  - [ ] `api`: `npm ci && npm run lint && npm test`
  - [ ] `runner`: `npm ci && npm run lint && npm test`
  - [ ] `frontend`: `npm ci && npm run lint && npm run build`

- **Security**
  - [ ] `.env` and secrets are gitignored
  - [ ] No secrets in commit history for the release tag
  - [ ] Webhook signature verification enabled

- **Release**
  - [ ] Create tag `v0.1.0`
  - [ ] Create GitHub Release with notes copied from `CHANGELOG.md`
  - [ ] Announce (optional): communities/users list from PIP-8

