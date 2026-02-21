# Changelog

## [1.2.0] - 2026-02-21

### Added

- **`codegoat fix` command** — AI-powered autofix for review findings
  - Two-phase workflow: review first, then generate targeted fixes per finding
  - **Interactive mode** (default): shows finding → proposed diff → accept/skip/quit
  - `--apply` flag: auto-apply all fixes without prompting
  - `--dry-run` flag: preview fixes without writing to disk
  - **Git stash safety**: auto-stashes uncommitted changes before interactive fixes
  - 30-line context window around each finding for precise LLM fix generation
  - Minimal-change instructions — fixes the issue without rewriting surrounding code
  - Lazy fix generation — only calls LLM when user doesn't skip
  - JSON output (`--format json`) for VS Code extension integration
  - 10 new tests (183 total, all passing)

## [1.1.0] - 2026-02-21

### Added

- **Google Gemini provider** — 4th LLM provider
  - Default model: gemini-2.0-flash (free tier friendly)
  - Auth: `GOOGLE_API_KEY` or `CODEGOAT_API_KEY` fallback
  - SSE streaming via Gemini `streamGenerateContent` API
  - System instructions via `systemInstruction` parameter

- **VS Code extension** — AI code review in your editor
  - Thin CLI wrapper (`codegoat-vscode/`)
  - Commands: Review File, Review Workspace, Clear Diagnostics
  - Inline diagnostics with severity → DiagnosticSeverity mapping
  - Status bar with review status and finding counts
  - Settings: provider, model, severity, reviewOnSave, cliPath
  - Review on save (configurable, off by default)

- **Bitbucket Pipelines CI** — 3rd CI platform
  - Inline PR comments via Bitbucket REST API 2.0
  - Auto-detect via `BITBUCKET_PIPELINE_UUID`
  - `bitbucket-pipelines.yml` template in docs

- **Monorepo support** — Config walk-up with deep merge
  - `.codegoatrc` inheritance from target dir to repo root
  - Package boundary detection (package.json, go.mod, Cargo.toml, etc.)

## [1.0.0] - 2026-02-21 🎉

### 🐐 codegoat v1.0 — AI-Powered Code Review for Every Developer

The first stable release. Everything you need to add AI code review to your workflow — from a quick local scan to fully automated PR reviews in CI.

### Core Features

- **`codegoat review <path>`** — Full codebase review with AI
- **`codegoat review . --diff`** — PR-level review of only changed files
- **`codegoat review . --watch`** — Live review as you code (file watcher with 500ms debounce)
- **`codegoat docs <path>`** — AI documentation generation (project/file/function levels)
- **`codegoat init`** — Generate starter `.codegoatrc` config

### 8 Languages Supported

TypeScript, JavaScript, Python, Go, Ruby, Java, Rust — with language-specific documentation styles (JSDoc, docstrings, godoc, YARD, Javadoc, rustdoc)

### 3 LLM Providers

- **OpenAI** — GPT-4o, GPT-4o-mini, any OpenAI-compatible model
- **Anthropic** — Claude 3.5 Sonnet, Claude 3 Opus
- **Ollama** — Run locally with any model, no API key needed

### 3 CI Platforms with Inline Comments

- **GitHub Actions** — Inline PR comments via Reviews API, `REQUEST_CHANGES` on critical findings
- **GitLab CI** — Inline MR comments via Discussions API, self-hosted support
- **Bitbucket Pipelines** — Inline PR comments via REST API 2.0

### Severity System

- 4 levels: 🔴 critical, 🟡 warning, 🔵 info, ⚪ style
- `--severity` threshold filter (default: info)
- `--fail-on` exit code control (default: critical)
- `--comment-severity` for inline CI comments (default: warning)

### Configuration

- **`.codegoatrc`** — JSON config with provider, model, budget, custom rules
- **`.codegoatignore`** — Gitignore-syntax file exclusion (additive to .gitignore)
- **Custom rules** — Project-specific review rules injected into LLM prompts
- **Monorepo support** — Config walk-up with deep merge (child wins on scalars, rules concatenate)
- **Package detection** — Automatic boundary detection via package.json, go.mod, Cargo.toml, etc.

### Review Caching

- Content-aware cache keys (file hash + config + version)
- `.codegoat-cache/` with 10MB LRU eviction
- `codegoat cache status` and `codegoat cache clear`
- `--no-cache` flag for fresh reviews

### CLI Polish

- Standardized exit codes: 0=success, 1=findings, 2=config error, 3=network error
- `--verbose` for debug logging, `--quiet` for scripting
- ANSI colors with `--no-color` support
- Progress spinner during LLM calls
- JSON output with `--format json`

### Architecture

- **Minimal dependencies** — Only `commander` + `ignore` at runtime
- **Native `fetch`** for all API calls (no SDKs)
- **Streaming** via `AsyncIterable<string>` across all providers
- **168 tests**, all passing

## [0.7.0] - 2026-02-21

### Added

- **Ruby (.rb), Java (.java), Rust (.rs) language support** — 8 languages total
  - Docs command: YARD (Ruby), Javadoc (Java), rustdoc (Rust)

- **GitLab CI integration** — inline MR comments via Discussions API
  - Auto-detects GitLab CI via `GITLAB_CI` env var
  - Auth: `GITLAB_TOKEN` or `CI_JOB_TOKEN` (default in GitLab CI)
  - Self-hosted GitLab support via `CI_API_V4_URL`
  - `--ci-platform` flag for manual override
  - `.gitlab-ci.yml` template in docs

- **CI adapter abstraction** — `CIAdapter` interface for multi-platform support
  - Shared diff parsing + finding mapping across GitHub and GitLab
  - Bitbucket-ready architecture

## [0.6.0] - 2026-02-21

### Added

- **Inline PR comments** — GitHub Reviews API integration
  - Posts inline comments on exact diff lines (up to 30 per review)
  - Single review = 1 notification to PR author
  - `REQUEST_CHANGES` when `--fail-on` threshold exceeded, `COMMENT` otherwise
  - Closest-line fallback for findings near but not on diff lines
  - Dismisses previous codegoat reviews before posting new one
  - `--comment-mode inline|summary|log` (auto-detects PR context)
  - `--comment-severity <level>` (default: warning — info/style in body only)

- **Demo repository** — [codegoat-demo](https://github.com/ricardomedina98/codegoat-demo)
  - Multi-language codebase (JS/TS, Python, Go) with intentional issues
  - Pre-configured `.codegoatrc`, `.codegoatignore`, GitHub Action workflow
  - Example review outputs for full scan, diff, and severity filtering

### Changed

- GitHub Action simplified — inline comments handled inside review command
- Action inputs: added `severity`, `fail-on`, `comment-mode`, `comment-severity`

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
