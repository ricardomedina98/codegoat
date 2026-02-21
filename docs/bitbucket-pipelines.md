# Bitbucket Pipelines Integration

codegoat auto-detects Bitbucket Pipelines and posts inline comments on Pull Request diffs.

## Quick Setup

Add to your `bitbucket-pipelines.yml`:

```yaml
pipelines:
  pull-requests:
    '**':
      - step:
          name: codegoat review
          image: node:20
          script:
            - npm install -g codegoat
            - codegoat review . --diff
          after-script:
            - echo "Review complete"
```

## Authentication

Set these as **repository variables** in Bitbucket settings:

- **`CODEGOAT_API_KEY`** — Your LLM API key (e.g. OpenAI)
- **`BITBUCKET_TOKEN`** — App Password with `pullrequest:write` scope

### Creating a Bitbucket App Password

1. Go to **Personal settings → App passwords**
2. Create with permissions: **Pull requests: Write**
3. Add as repository variable `BITBUCKET_TOKEN`

## Environment Variables

These are auto-set by Bitbucket Pipelines:

| Variable | Description |
|----------|-------------|
| `BITBUCKET_PIPELINE_UUID` | Triggers auto-detection |
| `BITBUCKET_WORKSPACE` | Workspace slug |
| `BITBUCKET_REPO_SLUG` | Repository slug |
| `BITBUCKET_PR_ID` | Pull request ID |
| `BITBUCKET_COMMIT` | HEAD commit SHA |

## Configuration

| Flag | Default | Description |
|------|---------|-------------|
| `--severity <level>` | `info` | Minimum severity to show |
| `--fail-on <level>` | `critical` | Exit 1 at this severity |
| `--comment-mode <mode>` | `inline` | `inline`, `summary`, or `log` |
| `--comment-severity <level>` | `warning` | Min severity for inline comments |
| `--ci-platform bitbucket` | auto | Force Bitbucket detection |

## How It Works

1. Detects Bitbucket via `BITBUCKET_PIPELINE_UUID`
2. Fetches PR diff via Bitbucket REST API 2.0
3. Runs AI review on changed files
4. Posts inline comments on diff lines
5. Posts summary comment with severity counts
6. Previous codegoat comments auto-deleted on re-run
