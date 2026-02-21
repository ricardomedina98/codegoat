# CI/CD Guide

Automate code reviews on every pull request with the codegoat GitHub Action.

## Basic Setup

Add this workflow to your repo:

```yaml
# .github/workflows/codegoat.yml
name: Code Review
on:
  pull_request:
    types: [opened, synchronize]

permissions:
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # needed for diff review

      - uses: opengoat/codegoat@main
        with:
          api-key: ${{ secrets.OPENAI_API_KEY }}
```

That's it. Every PR gets an AI review as a comment.

---

## Action Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `api-key` | **Yes** | — | LLM API key |
| `provider` | No | `openai` | LLM provider |
| `model` | No | `gpt-4o-mini` | Model name |
| `budget` | No | `100000` | Token budget |
| `severity` | No | `info` | Minimum severity to show in PR comment |
| `fail-on` | No | `critical` | Minimum severity to fail the check |
| `mode` | No | `diff` | Review mode: `diff` (PR changes only) or `full` (entire repo) |
| `github-token` | No | `${{ github.token }}` | Token for posting PR comments |

---

## Severity and Fail Conditions

### What gets shown in the PR comment

Controlled by `severity` — threshold filter:

| severity | Shows in comment |
|----------|------------------|
| `critical` | Only critical |
| `warning` | Critical + warning |
| `info` (default) | Critical + warning + info |
| `style` | Everything |

### What fails the CI check

Controlled by `fail-on`:

| fail-on | CI fails when |
|---------|--------------|
| `critical` (default) | Any critical finding |
| `warning` | Any warning or critical |
| `none` | Never fails (advisory only) |

### Examples

```yaml
# Strict — fail on any warning or above, show everything
- uses: opengoat/codegoat@main
  with:
    api-key: ${{ secrets.OPENAI_API_KEY }}
    severity: style
    fail-on: warning

# Advisory — never block PRs, just comment
- uses: opengoat/codegoat@main
  with:
    api-key: ${{ secrets.OPENAI_API_KEY }}
    fail-on: none

# Focused — only show critical and warning
- uses: opengoat/codegoat@main
  with:
    api-key: ${{ secrets.OPENAI_API_KEY }}
    severity: warning
    fail-on: critical
```

---

## PR Comment Format

The action posts a comment on the PR grouped by severity:

```markdown
## 🐐 codegoat review

**3 files changed** · 🔴 1 critical · 🟡 2 warnings · 🔵 1 info

### 🔴 Critical

**src/auth.ts:42** — Password comparison vulnerable to timing attack

### 🟡 Warnings

**src/payment.ts:89** — No error handling for network timeout
**src/payment.ts:102** — Amount not validated before charge

### 🔵 Info

**src/utils.ts:15** — Consider extracting validation to shared helper

Score: 6/10
```

- On new pushes to the same PR, the previous codegoat comment is **replaced** (not duplicated).
- Style findings are omitted from PR comments by default to reduce noise.

---

## Diff vs Full Review

By default, the action reviews **only the files changed in the PR** (`mode: diff`). This is faster, cheaper, and more relevant.

```yaml
# Review only PR changes (default)
- uses: opengoat/codegoat@main
  with:
    api-key: ${{ secrets.OPENAI_API_KEY }}
    mode: diff

# Review the entire repo (useful for initial setup)
- uses: opengoat/codegoat@main
  with:
    api-key: ${{ secrets.OPENAI_API_KEY }}
    mode: full
```

### Cost comparison

For a 10,000-line repo with a 200-line PR:

| Mode | Lines reviewed | Approx. cost (gpt-4o-mini) |
|------|----------------|----------------------------|
| `diff` | ~200 + context | ~$0.005 |
| `full` | ~10,000 | ~$0.03 |

Over 100 PRs/month, that's **$0.50 vs $3** — both cheap, but diff is 6x cheaper.

---

## Using with Anthropic

```yaml
- uses: opengoat/codegoat@main
  with:
    api-key: ${{ secrets.ANTHROPIC_API_KEY }}
    provider: anthropic
    model: claude-sonnet-4-20250514
```

---

## Using .codegoatrc in CI

If your repo has a `.codegoatrc`, the action respects it. CLI inputs override the config:

```yaml
# .codegoatrc says provider: openai
# But this overrides to anthropic
- uses: opengoat/codegoat@main
  with:
    api-key: ${{ secrets.ANTHROPIC_API_KEY }}
    provider: anthropic
```

Custom `rules` and `context` from `.codegoatrc` are always applied in CI.

---

## Only review certain file types

Use `.codegoatignore` in your repo to exclude files from CI reviews:

```gitignore
# Don't review in CI
migrations/
test/fixtures/
*.generated.ts
```

---

## Monorepo setup

For monorepos, you can run codegoat on specific paths:

```yaml
jobs:
  review-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: opengoat/codegoat@main
        with:
          api-key: ${{ secrets.OPENAI_API_KEY }}
          # Only review if API files changed
          # (use path filters on the workflow trigger)

  review-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: opengoat/codegoat@main
        with:
          api-key: ${{ secrets.OPENAI_API_KEY }}
```

> 💡 Tip: Use [paths filter](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#onpushpull_requestpull_request_targetpathspaths-ignore) on the workflow trigger to only run reviews when relevant files change.
