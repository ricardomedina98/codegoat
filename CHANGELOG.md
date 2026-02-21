# Changelog

## [0.5.0] - 2026-02-21

### Added

- **Watch mode** — `codegoat review . --watch`
  - Monitors file changes, reviews only changed files on save
  - 500ms debounce batches rapid saves
  - Severity summary after each incremental review
  - Respects .codegoatignore, clean Ctrl+C shutdown
  - Native `fs.watch` — no new dependencies

- **Review caching system** — instant results on unchanged files
  - Cache key: content hash + config hash + codegoat version
  - `.codegoat-cache/` directory, auto-added to .gitignore
  - `codegoat cache status` — view cache statistics
  - `codegoat cache clear` — wipe all cached reviews
  - `--no-cache` flag to force fresh review
  - 10MB max with LRU eviction, corrupt entry auto-cleanup
  - Skipped for `--diff` mode (diffs are always fresh)

## [0.4.0] - 2026-02-21

### Added

- **`.codegoatignore`** — Gitignore-syntax file to exclude files from review
  - Additive to .gitignore, supports globs and negation patterns
  - `--no-ignore` flag to skip .codegoatignore

- **Custom review rules** — `rules` array in `.codegoatrc`
  - Project-specific rules injected into LLM review prompts
  - Max 20 rules, 200 chars each, with validation
  - `codegoat init` generates example rules

- **Documentation site content** — Comprehensive guides in `docs/`
  - Quick start guide, configuration reference, provider setup
  - CI/CD integration guide, usage examples

## [0.3.0] - 2026-02-21

### Added

- **Python and Go support** — `.py` and `.go` files now discovered and reviewed
  - Docs command generates docstrings (Python) and godoc (Go) at function level

- **Severity levels** — 4-level system: 🔴 critical, 🟡 warning, 🔵 info, ⚪ style
  - LLM categorizes each finding by severity
  - `--severity <level>` flag — threshold filter (default: info, hides style)
  - `CODEGOAT_SEVERITY` env var support
  - JSON output includes `findings[].severity`, `counts`, `maxSeverity`
  - Backward-compatible: Bug/Security → critical, Performance → warning

- **`--fail-on <level>`** — CI exit code control
  - Exit 1 when max severity >= threshold (default: critical)
  - `--fail-on none` disables exit codes (advisory only)

- **CONTRIBUTING.md** — Development setup, project structure, code style guide
- **GitHub issue templates** — Bug report and feature request templates
- **PR template** — Pull request checklist

### Changed

- Review prompts updated with severity-aware instructions
- README polished with "Why codegoat" section, comparison table, usage examples
- Roadmap updated to reflect shipped features

## [0.2.0] - 2026-02-21

### Added

- **Anthropic Claude provider** — `--provider anthropic` with streaming via Messages API
- **Ollama local model provider** — `--provider ollama`, no API key needed
- **`codegoat docs <path>`** — Documentation generation (project/file/function levels)
- **`--diff` PR-level review mode** — Review only changed files from git diff
- **`.codegoatrc` config file** — JSON config with `codegoat init` command
- **Output formatting** — `--format json`, `--no-color`, color-coded categories, progress spinner
- **GitHub Action** — Auto-uses `--diff` on pull requests
- **GitHub Actions CI** — Test matrix on Node 18, 20, 22

### Fixed

- Zero-budget edge case: exits gracefully instead of attempting LLM call

## [0.1.0] - 2026-02-21

### Added

- **`codegoat review <path>`** — AI-powered code review
  - File discovery with .gitignore support, 50KB file cap, binary detection
  - Token budgeting (100K default)
  - OpenAI integration (gpt-4o-mini default) with streaming output
- **Supported languages:** TypeScript, JavaScript
- **LLM providers:** OpenAI
