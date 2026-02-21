# Configuration

codegoat works with zero config. Everything here is optional — use it when you need it.

## Configuration sources

In order of precedence (highest wins):

1. **CLI flags** — `--model gpt-4o`
2. **Environment variables** — `CODEGOAT_MODEL=gpt-4o`
3. **`.codegoatrc`** — project-level config file
4. **Defaults** — sensible out of the box

---

## .codegoatrc

Project-level configuration in YAML. Place in your project root.

### Full example

```yaml
# .codegoatrc

# LLM settings
provider: anthropic
model: claude-sonnet-4-20250514
budget: 150000

# Review settings
severity: info          # Show critical + warning + info (hide style)
fail-on: critical       # CI exits non-zero only on critical findings

# Custom rules — injected into the LLM's review prompt
rules:
  - "Always check for SQL injection in database queries"
  - "React components must use PascalCase naming"
  - "All API endpoints must validate input with zod schemas"
  - "Never use console.log — use the Logger service"
  - "[critical] Never commit secrets, API keys, or credentials"

# Project context — helps the LLM understand your codebase
context: |
  NestJS monorepo with microservices.
  Temporal for workflows, Formance for the ledger.
  All monetary values are in cents (integer), never floats.
```

### Fields reference

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `provider` | string | `openai` | LLM provider (`openai`, `anthropic`, `ollama`) |
| `model` | string | `gpt-4o-mini` | Model name |
| `budget` | number | `100000` | Max token budget for file content |
| `severity` | string | `info` | Minimum severity to show (`critical`, `warning`, `info`, `style`) |
| `fail-on` | string | `critical` | Minimum severity to fail CI (`critical`, `warning`, `none`) |
| `rules` | string[] | `[]` | Custom review rules (max 20) |
| `context` | string | `""` | Project context for the LLM (max 2000 chars) |

### Custom rules

Rules are injected into the LLM prompt. Write them as clear, specific instructions:

```yaml
rules:
  # Good — specific and actionable
  - "All async functions must have try/catch or propagate errors explicitly"
  - "Database queries must use parameterized statements, never string concatenation"

  # Bad — too vague
  - "Write good code"
  - "Follow best practices"
```

**Severity prefix:** Add `[critical]` or `[warning]` to set the severity of violations:

```yaml
rules:
  - "[critical] Never commit AWS credentials or API keys"
  - "[warning] All public functions must have JSDoc comments"
  - "Use shared Logger instead of console.log"  # defaults to warning
```

### Project context

Context helps the LLM give relevant feedback. Include:
- Tech stack and frameworks
- Key conventions (naming, patterns, etc.)
- Domain-specific rules (e.g., "money is in cents")

```yaml
context: |
  Express.js REST API with PostgreSQL.
  We use the repository pattern for data access.
  All dates are stored and transmitted as ISO 8601 UTC.
```

---

## .codegoatignore

Exclude files and directories from review. Uses the same syntax as `.gitignore`.

### Example

```gitignore
# Generated code
src/generated/
src/**/*.generated.ts

# Migrations
migrations/

# Vendor/third-party
vendor/

# Config files
*.config.js
*.config.ts

# Test fixtures
test/fixtures/

# But DO review the main app config
!app.config.ts
```

### How it works

- **Additive to `.gitignore`** — files excluded by `.gitignore` are always excluded. `.codegoatignore` adds more exclusions on top.
- **Negation works** — use `!pattern` to include files despite earlier exclusions in `.codegoatignore`.
- **Cannot override `.gitignore`** — if `.gitignore` excludes a file, `.codegoatignore` can't bring it back (git doesn't track it).

### CLI override

```bash
# Ignore .codegoatignore (review everything)
codegoat review . --no-ignore

# Use a custom ignore file
codegoat review . --ignore-file ./custom-ignore
```

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `CODEGOAT_API_KEY` | **Required.** LLM API key | `sk-...` |
| `CODEGOAT_PROVIDER` | LLM provider | `anthropic` |
| `CODEGOAT_MODEL` | Model name | `gpt-4o` |
| `CODEGOAT_MAX_TOKENS` | Token budget | `150000` |
| `CODEGOAT_SEVERITY` | Severity threshold | `warning` |
| `CODEGOAT_OLLAMA_URL` | Custom Ollama endpoint | `http://localhost:11434` |
| `NO_COLOR` | Disable color output | `1` |

> 💡 Tip: Put API key in env vars, project-specific settings in `.codegoatrc`, and use CLI flags for one-off overrides.

---

## CLI Flags

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --provider <name>` | LLM provider | `openai` |
| `-m, --model <name>` | Model name | `gpt-4o-mini` |
| `-b, --budget <tokens>` | Token budget | `100000` |
| `-f, --format <type>` | Output: `markdown` or `json` | `markdown` |
| `-s, --severity <level>` | Severity threshold | `info` |
| `--fail-on <level>` | CI failure threshold | `critical` |
| `--diff [ref]` | Review only changed files | — |
| `--no-ignore` | Ignore .codegoatignore | `false` |
| `--ignore-file <path>` | Custom ignore file | — |
| `--no-color` | Disable color output | auto-detect |
