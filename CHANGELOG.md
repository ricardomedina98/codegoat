# Changelog

## [0.2.0] - 2026-02-21

### Added

- **Anthropic Claude provider** — `--provider anthropic` with streaming via Messages API
  - Default model: `claude-3-haiku-20240307`
  - Handles system prompt via Anthropic's `system` parameter

- **Ollama local model provider** — `--provider ollama`, no API key needed
  - Default model: `codellama`
  - Configurable endpoint via `CODEGOAT_OLLAMA_URL` (default: `http://localhost:11434`)
  - Helpful error message when Ollama isn't running

- **`codegoat docs <path>`** — AI-powered documentation generation
  - `--level project` — README-style overview (default)
  - `--level file` — Per-file documentation
  - `--level function` — JSDoc/TSDoc comment generation

- **`--diff` PR-level review mode** — Review only changed files
  - `codegoat review . --diff` — staged/unstaged changes
  - `codegoat review . --diff main` — diff against branch
  - `codegoat review . --diff HEAD~3..HEAD` — commit range
  - Smart context: full file for <300 lines, 50-line window for large files
  - `[changed]`/`[context]` markers for focused LLM review
  - GitHub Action auto-uses `--diff` on pull requests

- **`.codegoatrc` config file** — JSON config in project or home directory
  - Supports: `provider`, `model`, `budget`, `format`, `ollamaUrl`
  - Precedence: CLI flags > env vars > project config > home config
  - `codegoat init` command generates a starter config

- **Output formatting improvements**
  - `--format json` for CI integration
  - `--no-color` flag + `NO_COLOR` env var support
  - Color-coded issue categories (Bug/Security in red, Performance in yellow, Style/Clarity in cyan)
  - Progress spinner while waiting for LLM response
  - Summary stats header

- **GitHub Action** — Composite action for automated PR reviews
  - Posts review as PR comment, replaces previous comments on re-push
  - Auto-uses `--diff` mode on pull request events

- **GitHub Actions CI** — Test matrix on Node 18, 20, 22

### Fixed

- Zero-budget edge case: exits gracefully instead of attempting LLM call

## [0.1.0] - 2026-02-21

### Added

- **`codegoat review <path>`** — AI-powered code review
  - File discovery with .gitignore support, 50KB file cap, binary detection
  - Token budgeting (100K default, configurable via `--budget`)
  - OpenAI integration (gpt-4o-mini default) with streaming output
  - Categorized issues: Bug, Security, Performance, Style, Clarity

- **Supported languages:** `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`
- **LLM providers:** OpenAI
