# 🐐 codegoat

[![v1.0.0](https://img.shields.io/badge/version-1.0.0-brightgreen)](https://github.com/ricardomedina98/codegoat/releases/tag/v1.0.0) [![Tests](https://img.shields.io/badge/tests-168%20passing-brightgreen)]() [![License: MIT](https://img.shields.io/badge/license-MIT-blue)]()

**AI-powered code review for developers who ship fast.** Free, open source, runs on your machine.

```bash
npx codegoat review .
```

That's it. No account, no subscription, no sending your code to a third party.

---

## Why codegoat?

Every AI code review tool wants $20-30/developer/month and requires sending your code to their servers. We think that's backwards.

| | CodeRabbit | Sourcery | Copilot CR | **codegoat** |
|---|---|---|---|---|
| **Cost** | $30/seat/mo | $24/dev/mo | $10-39/mo | **Free** |
| **Open source** | ❌ | ❌ | ❌ | **✅ MIT** |
| **CLI for local review** | ❌ | ❌ | ❌ | **✅** |
| **Choose your LLM** | ❌ | ❌ | ❌ | **✅** |
| **Code stays local** | ❌ | ❌ | ❌ | **✅** |

**The math:** A team of 5 pays ~$150/month for CodeRabbit. With codegoat + GPT-4o-mini, the same team pays **~$3/month** in API costs. That's 50x cheaper.

### What makes codegoat different

- 🆓 **Free forever** — MIT licensed. No seat fees, no subscriptions, no "free tier limits."
- 🔑 **Bring your own LLM** — OpenAI, Anthropic, or local models via Ollama. Switch anytime.
- 🖥️ **CLI-first** — Review code before you push, not after. Works in your terminal, your scripts, your CI.
- 🔒 **Your code stays yours** — Runs on your machine. With Ollama, nothing leaves your network.
- 🤖 **GitHub Action included** — Automated PR reviews without SaaS dependencies.
- ⚡ **Zero config** — One command. One env var. Done.

---

## Getting Started (60 seconds)

### 1. Get an API key

Grab one from [OpenAI](https://platform.openai.com/api-keys), [Anthropic](https://console.anthropic.com/), or use [Ollama](https://ollama.ai) for free local models.

```bash
export CODEGOAT_API_KEY=sk-...
```

### 2. Run your first review

```bash
# Review current directory
npx codegoat review .

# Review a specific folder
npx codegoat review ./src

# Use Claude instead of GPT
npx codegoat review . --provider anthropic

# Use a local model (no API key needed!)
npx codegoat review . --provider ollama
```

### 3. That's it

No install needed (`npx` runs it directly). No account. No config file required.

Want to install globally?

```bash
npm install -g codegoat
codegoat review .
```

---

## Commands

| Command | Description |
|---------|-------------|
| `codegoat review <path>` | Review code at the given path |
| `codegoat review . --diff` | Review only changed files from git diff |
| `codegoat docs <path>` | Generate documentation |
| `codegoat init` | Generate a starter `.codegoatrc` config |

## CLI Options

### `codegoat review`

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --provider <name>` | LLM provider | `openai` |
| `-m, --model <name>` | Model name | `gpt-4o-mini` |
| `-b, --budget <tokens>` | Max token budget | `100000` |
| `-f, --format <type>` | Output: `markdown` or `json` | `markdown` |
| `-d, --diff [ref]` | Review only changed files | — |
| `--no-color` | Disable color output | auto-detect |

### `codegoat docs`

| Flag | Description | Default |
|------|-------------|---------|
| `-l, --level <level>` | `project`, `file`, or `function` | `project` |

---

## Usage Examples

### Review your project

```bash
$ codegoat review ./src

### src/routes/auth.ts
- **Security (line 42):** Password comparison uses `===` — vulnerable to timing attacks.
- **Style (line 67):** `generateToken()` hardcodes expiry. Make configurable.

### src/middleware/rateLimit.ts
- **Bug (line 15):** Rate limit counter resets on restart (in-memory store).

3 issues found: 1 bug, 1 security, 1 style
```

### Review only your changes

```bash
# Staged changes
$ codegoat review . --diff

# Changes vs main branch
$ codegoat review . --diff main

# Last 3 commits
$ codegoat review . --diff HEAD~3..HEAD
```

### Generate documentation

```bash
# Project overview
$ codegoat docs .

# Per-file documentation
$ codegoat docs . --level file

# JSDoc/TSDoc comments
$ codegoat docs . --level function
```

### JSON output for CI

```bash
$ codegoat review . --format json | jq .
```

---

## Providers

### OpenAI (default)

```bash
export CODEGOAT_API_KEY=sk-...
codegoat review .
```

### Anthropic Claude

```bash
export CODEGOAT_API_KEY=sk-ant-...
codegoat review . --provider anthropic
```

Default model: `claude-3-haiku-20240307`. Override with `--model claude-sonnet-4-20250514`.

### Ollama (local, free)

```bash
# Install Ollama: https://ollama.ai
ollama pull codellama

# No API key needed!
codegoat review . --provider ollama

# Custom model
codegoat review . --provider ollama --model deepseek-coder

# Custom Ollama URL (default: http://localhost:11434)
CODEGOAT_OLLAMA_URL=http://192.168.1.100:11434 codegoat review . --provider ollama
```

---

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
| `CODEGOAT_API_KEY` | **Required** (except Ollama). Your LLM provider API key |
| `CODEGOAT_PROVIDER` | LLM provider (`openai`, `anthropic`, `ollama`) |
| `CODEGOAT_MODEL` | Model name |
| `CODEGOAT_MAX_TOKENS` | Token budget for file content |
| `CODEGOAT_OLLAMA_URL` | Ollama endpoint (default: `http://localhost:11434`) |
| `NO_COLOR` | Disable color output (any value) |

---

## GitHub Action

Automated PR reviews in 30 seconds:

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
          fetch-depth: 0
      - uses: ricardomedina98/codegoat@main
        with:
          api-key: ${{ secrets.OPENAI_API_KEY }}
```

The action auto-uses `--diff` mode on PRs for faster, cheaper, more focused reviews.

### Action Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `api-key` | Yes | — | LLM API key |
| `provider` | No | `openai` | LLM provider |
| `model` | No | `gpt-4o-mini` | Model name |
| `budget` | No | `100000` | Token budget |
| `github-token` | No | `${{ github.token }}` | For PR comments |

---

## Supported Languages

- **TypeScript / JavaScript:** `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`
- **Python:** `.py`
- **Go:** `.go`
- **Ruby:** `.rb`
- **Java:** `.java`
- **Rust:** `.rs`

More coming based on demand — [open an issue](../../issues) to request yours.

## Roadmap

- [x] Full repo review
- [x] OpenAI + Anthropic + Ollama providers
- [x] GitHub Action (with auto-diff on PRs)
- [x] JSON output for CI
- [x] PR/diff review mode (`--diff`)
- [x] Documentation generation (`docs` command)
- [x] `.codegoatrc` config file
- [ ] Inline PR comments via GitHub Reviews API
- [ ] Custom review rules / prompt overrides
- [ ] More languages (Python, Go, Rust...)
- [ ] `.codegoatignore` for excluding files

## Contributing

We'd love your help! See [CONTRIBUTING.md](CONTRIBUTING.md) for how to get started.

Whether it's adding a new language, fixing a bug, improving prompts, or just fixing a typo — all contributions are welcome. 🐐

## License

MIT — do whatever you want with it.
