# Changelog

## [0.1.0] - 2026-02-21

### Added

- **`codegoat review <path>`** — AI-powered code review
  - File discovery with .gitignore support, 50KB file cap, binary detection
  - Token budgeting (100K default, configurable via `--budget`)
  - OpenAI integration (gpt-4o-mini default) with streaming output
  - Categorized issues: Bug, Security, Performance, Style, Clarity
  - `--format json` for CI integration
  - `--no-color` flag + `NO_COLOR` env var support
  - Progress spinner while waiting for LLM response

- **`codegoat docs <path>`** — AI-powered documentation generation
  - `--level project` — README-style overview (default)
  - `--level file` — Per-file documentation
  - `--level function` — JSDoc/TSDoc comment generation

- **GitHub Action** — Composite action for automated PR reviews
  - Posts review as PR comment
  - Replaces previous comments on re-push

- **Supported languages:** `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`
- **LLM providers:** OpenAI (more coming)
