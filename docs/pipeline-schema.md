# `.pipelineos.yml` schema (Phase 1)

Committed at the repository root (or path resolved by the GitHub Contents API). The runner fetches the file at the triggering commit SHA.

## Required fields

```yaml
name: string               # Pipeline display name
on:                        # Triggers (subset implemented in Phase 1)
  - push
  - pull_request
stages:                    # Ordered declarative list; execution order follows depends_on
  - name: string           # Unique among stages
    image: string          # Docker image reference, e.g. node:20-alpine
    run: string            # Shell command executed in the container
```

## Optional stage fields

```yaml
    depends_on:
      - <other stage name>
    env:
      KEY: value
    timeout_minutes: int   # Default: 10 when omitted
```

## Example

```yaml
name: "Node.js CI"
on:
  - push
  - pull_request
stages:
  - name: install
    image: node:20-alpine
    run: npm ci

  - name: lint
    image: node:20-alpine
    run: npm run lint
    depends_on:
      - install

  - name: test
    image: node:20-alpine
    run: npm test
    depends_on:
      - install

  - name: build
    image: node:20-alpine
    run: npm run build
    depends_on:
      - lint
      - test
```

## Validation rules (runner)

- `name`, `on`, and `stages` must be present.
- Stage `name` values must be unique.
- `depends_on` references must resolve to defined stages.
- Dependency graph must be **acyclic** (topological order exists).
