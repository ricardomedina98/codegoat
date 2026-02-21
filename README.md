# 🐐 codegoat

[![npm version](https://img.shields.io/npm/v/codegoat.svg)](https://www.npmjs.com/package/codegoat)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/opengoat/codegoat.svg)](https://github.com/opengoat/codegoat/stargazers)

**One CLI that reviews, fixes, tests, and documents your code.** Free, open source, runs locally.

```bash
codegoat review .     # find bugs and security issues
codegoat fix .        # generate and apply fixes
codegoat test .       # generate unit tests
codegoat docs .       # generate documentation
```

No account. No subscription. No sending your code to a third party.

---

## Why codegoat?

Every AI code review tool charges $20-30/developer/month and requires your code to pass through their servers.

| | CodeRabbit | Sourcery | Copilot CR | **codegoat** |
|---|---|---|---|---|
| **Cost** | $30/seat/mo | $24/dev/mo | $10-39/mo | **Free (MIT)** |
| **Open source** | ❌ | ❌ | ❌ | **✅** |
| **CLI** | ❌ | ❌ | ❌ | **✅** |
| **Choose your LLM** | ❌ | ❌ | ❌ | **✅** |
| **Code stays local** | ❌ | ❌ | ❌ | **✅** |

**The math:** A team of 5 pays ~$150/month for CodeRabbit. With codegoat + gpt-4o-mini, the same team pays **~$3/month** in API costs.

### What makes codegoat different

- 🆓 **Free forever** — MIT licensed. No seat fees, no "upgrade to Pro."
- 🔑 **Bring your own LLM** — OpenAI, Anthropic, or local models via Ollama.
- 🖥️ **CLI-first** — Review code before you push. Works in your terminal, scripts, and CI.
- 🔒 **Your code stays yours** — With a local LLM, nothing leaves your network.
- 🤖 **CI-ready** — GitHub Actions + GitLab CI with inline PR/MR comments.
- ⚡ **Fast** — Caching means unchanged files are instant on repeat reviews.

---

## The Workflow

```
review → fix → test → docs
```

```bash
# 1. Find what's wrong
$ codegoat review src/auth.ts
  🔴 Line 42: Timing-unsafe password comparison
  🔴 Line 8: Hardcoded JWT secret

# 2. Fix it
$ codegoat fix src/auth.ts
  ✅ Applied: bcrypt.compare() for password verification
  ✅ Applied: JWT secret from env var

# 3. Test it
$ codegoat test src/auth.ts
  ✅ Generated: 12 test cases (login, register, verifyToken)

# 4. Document it
$ codegoat docs src/auth.ts
  ✅ Generated: API documentation
```

Each command works independently. Use one or all four.

---

## Quick Start

```bash
# 1. Set your API key
export CODEGOAT_API_KEY=sk-...

# 2. Review your code
npx codegoat review .
```

That's it. No install needed. [More setup options →](docs/quick-start.md)

---

## Commands

| Command | What it does |
|---------|-------------|
| `codegoat review <path>` | Find bugs, security issues, and improvements |
| `codegoat fix <path>` | Generate and apply fixes interactively |
| `codegoat test <path>` | Generate unit tests for untested functions |
| `codegoat docs <path>` | Generate documentation |
| `codegoat review --diff [ref]` | Review only changed files |
| `codegoat review --watch` | Review on save |
| `codegoat fix --apply` | Auto-apply all fixes |
| `codegoat test --framework <name>` | Use a specific test framework |
| `codegoat cache status` | View cache statistics |
| `codegoat init` | Generate `.codegoatrc` |

---

## Example Output

```bash
$ codegoat review ./src
```

```
🐐 codegoat review — src/

12 files reviewed · 🔴 2 critical · 🟡 3 warnings · 🔵 2 info

### src/routes/auth.ts
🔴 critical — Line 42: Password comparison uses === instead of
   crypto.timingSafeEqual(). Vulnerable to timing attacks.

🔴 critical — Line 8: JWT secret hardcoded as string literal.
   Move to environment variable.

### src/services/payment.ts
🟡 warning — Line 89: No error handling for network timeout.
   gateway.charge() can hang indefinitely.

### src/utils/validate.ts
🔵 info — Email regex is overly permissive. Consider zod.

Score: 5/10
```

[More examples →](docs/examples.md) · [Demo repo with intentional bugs →](https://github.com/ricardomedina98/codegoat-demo)

---

## Providers

| Provider | Setup | Cost/review | Privacy |
|----------|-------|-------------|---------|
| **OpenAI** (default) | `CODEGOAT_API_KEY=sk-...` | ~$0.01 | Cloud |
| **Anthropic** | `--provider anthropic` | ~$0.005 | Cloud |
| **Ollama** (local) | `--provider ollama` | $0 | **Fully local** |

```bash
# Use Claude
codegoat review . --provider anthropic --model claude-sonnet-4-20250514

# Use a local model (no API key needed)
codegoat review . --provider ollama --model codellama
```

[Provider setup guide →](docs/providers.md)

---

## Severity Levels

| Level | Emoji | Meaning |
|-------|-------|---------|
| critical | 🔴 | Bugs, security vulnerabilities, crashes |
| warning | 🟡 | Likely problems, missing error handling |
| info | 🔵 | Suggestions, refactoring opportunities |
| style | ⚪ | Cosmetic, naming conventions |

```bash
# Show only critical + warning
codegoat review . --severity warning

# CI: fail on critical findings
codegoat review . --fail-on critical
```

---

## CI Integration

### GitHub Actions

```yaml
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
      - uses: opengoat/codegoat@v1
        with:
          api-key: ${{ secrets.OPENAI_API_KEY }}
```

Posts inline comments on the exact lines of your PR. One notification, all findings grouped.

### GitLab CI

```yaml
codegoat-review:
  stage: test
  image: node:20-alpine
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  script:
    - npx codegoat review --diff --ci
  variables:
    CODEGOAT_API_KEY: $CODEGOAT_API_KEY
```

[Full CI/CD guide →](docs/ci-cd.md)

---

## Configuration

### `.codegoatrc` — project rules

```yaml
provider: anthropic
model: claude-sonnet-4-20250514
severity: info
fail-on: critical

rules:
  - "All SQL queries must use parameterized statements"
  - "Never use console.log — use the Logger service"
  - "[critical] Never commit API keys or secrets"

context: |
  NestJS API with PostgreSQL. Money values in cents.
```

### `.codegoatignore` — exclude files

```gitignore
migrations/
vendor/
*.generated.ts
```

[Configuration guide →](docs/configuration.md)

---

## Supported Languages

TypeScript · JavaScript · Python · Go · Ruby · Java · Rust · C · C++ · PHP

More coming based on demand — [request yours](../../issues).

---

## CLI Reference

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --provider` | LLM provider | `openai` |
| `-m, --model` | Model name | `gpt-4o-mini` |
| `-b, --budget` | Token budget | `100000` |
| `-f, --format` | Output: `markdown` / `json` | `markdown` |
| `-s, --severity` | Severity threshold | `info` |
| `--fail-on` | CI failure threshold | `critical` |
| `--diff [ref]` | Review changed files only | — |
| `--watch` | Watch mode | — |
| `--ci` | Auto-detect CI + post comments | — |
| `--no-cache` | Skip cache | — |
| `--no-ignore` | Skip .codegoatignore | — |

---

## Contributing

We'd love your help! See [CONTRIBUTING.md](CONTRIBUTING.md).

Good first contributions:
- 🌍 Add a language
- 📝 Improve review prompts
- 🐛 Fix a bug
- 📖 Improve docs

---

## Roadmap

### Shipped ✅
- [x] Code review with severity levels
- [x] AI-powered code fixes (interactive + auto-apply)
- [x] Unit test generation (12 frameworks auto-detected)
- [x] Documentation generation
- [x] 4 LLM providers (OpenAI, Anthropic, Gemini, Ollama)
- [x] 11 languages (JS/TS, Python, Go, Ruby, Java, Rust, C, C++, PHP)
- [x] GitHub Actions + GitLab CI + Bitbucket Pipelines with inline comments
- [x] Caching + watch mode
- [x] Monorepo support (path-scoped configs)
- [x] Configuration (.codegoatrc, .codegoatignore)

### Coming next 🔜
- [ ] VS Code extension (preview available in `codegoat-vscode/`)
- [ ] Language Server Protocol (LSP) for universal editor support
- [ ] Coverage-aware test generation
- [ ] More languages (C#, PHP, Kotlin, Swift...)

---

## License

MIT — do whatever you want with it.
