# GitLab CI Integration

codegoat auto-detects GitLab CI environments and posts inline comments on Merge Request diffs.

## Quick Setup

Add to your `.gitlab-ci.yml`:

```yaml
codegoat-review:
  image: node:20
  stage: test
  rules:
    - if: $CI_MERGE_REQUEST_IID  # Only run on MRs
  script:
    - npm install -g codegoat
    - codegoat review . --diff
  variables:
    CODEGOAT_API_KEY: $OPENAI_API_KEY
    GITLAB_TOKEN: $GITLAB_TOKEN  # Or use CI_JOB_TOKEN (default)
```

## Authentication

codegoat uses these tokens (in order of priority):

1. **`GITLAB_TOKEN`** — Personal or project access token (recommended for full API access)
2. **`CI_JOB_TOKEN`** — Auto-provided in GitLab CI (limited permissions)

For inline MR comments, the token needs `api` scope. `CI_JOB_TOKEN` may have limited permissions depending on your GitLab version.

## Self-Hosted GitLab

codegoat reads `CI_API_V4_URL` automatically (set by GitLab CI). For manual override:

```yaml
variables:
  CI_API_V4_URL: https://gitlab.yourcompany.com/api/v4
```

## Configuration Options

| Flag | Default | Description |
|------|---------|-------------|
| `--severity <level>` | `info` | Minimum severity to show |
| `--fail-on <level>` | `critical` | Exit 1 at this severity |
| `--comment-mode <mode>` | `inline` | `inline`, `summary`, or `log` |
| `--comment-severity <level>` | `warning` | Minimum severity for inline comments |
| `--ci-platform gitlab` | auto | Force GitLab platform detection |

## Environment Variables

These are auto-set by GitLab CI:

- `GITLAB_CI` — Triggers GitLab auto-detection
- `CI_PROJECT_ID` — Project identifier
- `CI_MERGE_REQUEST_IID` — MR number
- `CI_COMMIT_SHA` — HEAD commit
- `CI_API_V4_URL` — API base URL

## How It Works

1. codegoat detects GitLab CI via `GITLAB_CI` env var
2. Fetches MR diff via GitLab API
3. Runs AI review on changed files
4. Posts inline comments on diff lines via MR Discussions API
5. Posts summary discussion with severity counts
6. Previous codegoat discussions are auto-deleted on re-run
