# codegoat

AI-powered code review and documentation generator for small teams.

## What it does

`codegoat` reads your codebase and generates meaningful code reviews and documentation. Built for solo developers and small teams (2-10 engineers) who ship faster than they document.

## Quick Start

```bash
# Set your API key
export CODEGOAT_API_KEY=sk-...

# Review the current directory
npx codegoat review .

# JSON output for CI
npx codegoat review . --format json

# Use a specific model
npx codegoat review . --model gpt-4o
```

## Commands

- `codegoat review <path>` — Review code at the given path
- `codegoat docs <path>` — Generate documentation (coming soon)

## CLI Options

### `codegoat review`

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --provider <name>` | LLM provider | `openai` |
| `-m, --model <name>` | Model name | `gpt-4o-mini` |
| `-b, --budget <tokens>` | Max token budget | `100000` |
| `-f, --format <type>` | Output format: `markdown` or `json` | `markdown` |
| `--no-color` | Disable color output | auto-detect |

## Providers

### OpenAI (default)

```bash
export CODEGOAT_API_KEY=sk-...
codegoat review .
```

### Anthropic Claude

```bash
export CODEGOAT_API_KEY=sk-ant-...
export CODEGOAT_PROVIDER=anthropic
codegoat review .

# Or use the --provider flag
codegoat review . --provider anthropic
```

Default model: `claude-3-haiku-20240307` (fast and cheap). Override with `--model claude-sonnet-4-20250514`.

### Ollama (local, free)

```bash
# Install Ollama: https://ollama.ai
# Pull a model
ollama pull codellama

# No API key needed!
codegoat review . --provider ollama

# Custom model
codegoat review . --provider ollama --model deepseek-coder

# Custom Ollama URL (default: http://localhost:11434)
CODEGOAT_OLLAMA_URL=http://192.168.1.100:11434 codegoat review . --provider ollama
```

Default model: `codellama`. Works with any model Ollama supports.

## Configuration File

Create a `.codegoatrc` in your project or home directory:

```bash
codegoat init
```

This generates a starter config:

```json
{
  "provider": "openai",
  "model": "gpt-4o-mini",
  "budget": 100000
}
```

All options: `provider`, `model`, `budget`, `format`, `ollamaUrl`.

**Precedence:** CLI flags > env vars > `.codegoatrc` (project) > `~/.codegoatrc` (home)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CODEGOAT_API_KEY` | **Required.** Your LLM provider API key |
| `CODEGOAT_PROVIDER` | LLM provider (`openai`, `anthropic`, `ollama`) |
| `CODEGOAT_OLLAMA_URL` | Ollama endpoint (default: `http://localhost:11434`) |
| `CODEGOAT_MODEL` | Model name |
| `CODEGOAT_MAX_TOKENS` | Token budget for file content |
| `NO_COLOR` | Disable color output (any value) |

## GitHub Action

Add automated code reviews to your PRs:

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

      - uses: your-org/codegoat@main
        with:
          api-key: ${{ secrets.OPENAI_API_KEY }}
          # Optional:
          # provider: openai
          # model: gpt-4o-mini
          # budget: 100000
```

### Action Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `api-key` | Yes | — | LLM API key |
| `provider` | No | `openai` | LLM provider |
| `model` | No | `gpt-4o-mini` | Model name |
| `budget` | No | `100000` | Token budget |
| `github-token` | No | `${{ github.token }}` | GitHub token for PR comments |

The action:
1. Installs and builds codegoat
2. Runs `codegoat review .` on your repo
3. Posts the review as a PR comment
4. Replaces previous codegoat comments on subsequent pushes

## Supported Languages

Currently: `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`

More coming based on demand.

## Status

🚧 Early development — v0.1.0

## License

MIT
