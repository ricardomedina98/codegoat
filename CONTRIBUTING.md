# Contributing to codegoat

Thanks for wanting to help! codegoat is built for solo devs and small teams — and that's exactly who we want contributing too. No contribution is too small.

## Quick Links

- [Issues](../../issues) — Bug reports, feature requests
- [Discussions](../../discussions) — Questions, ideas, show & tell

## Getting Started

### Prerequisites

- Node.js 20+
- An LLM API key (OpenAI or Anthropic) for running tests

### Setup

```bash
# Clone the repo
git clone https://github.com/opengoat/codegoat.git
cd codegoat

# Install dependencies
npm install

# Build
npm run build

# Run locally
node dist/cli.js review ./src
```

### Development workflow

```bash
# Watch mode (rebuilds on changes)
npm run dev

# Type-check without building
npm run lint

# Run tests
export CODEGOAT_API_KEY=sk-...  # needed for e2e tests
npm test

# Run a specific test
node --import tsx --test test/budget.test.ts
```

## Project Structure

```
src/
├── cli.ts          # CLI entry point (commander setup)
├── commands/       # Command implementations (review, docs)
├── files/          # File discovery, reading, filtering
├── output/         # Formatters (markdown, json)
└── providers/      # LLM providers (openai, anthropic)

test/               # Tests (node:test)
dist/               # Build output (don't edit)
```

## How to Contribute

### Report a bug

[Open a bug report](../../issues/new?template=bug_report.md). Include:
- What you ran (command + flags)
- What happened vs what you expected
- Node version, OS, provider/model used

### Request a feature

[Open a feature request](../../issues/new?template=feature_request.md). Tell us:
- What problem does it solve?
- Who benefits?

### Submit code

1. **Fork** the repo
2. **Create a branch** from `main` (`git checkout -b my-feature`)
3. **Make your changes** — keep commits focused
4. **Add tests** if you're changing behavior
5. **Run tests** (`npm test`) — make sure they pass
6. **Open a PR** — describe what you changed and why

### Good first contributions

- 🌍 **Add a language** — Add file extensions to the discovery module
- 📝 **Improve prompts** — Better prompts = better reviews
- 🐛 **Fix a bug** — Check [open issues](../../issues?q=is%3Aissue+is%3Aopen+label%3Abug)
- 📖 **Improve docs** — Typos, unclear instructions, missing examples

## Code Style

- **TypeScript** — strict mode, no `any` unless absolutely necessary
- **ESM** — use `import`/`export`, not `require`
- **No external linter** — just `tsc --strict`. Keep it simple.
- **Tests** — use `node:test` + `node:assert`. No test framework dependencies.
- **Naming** — descriptive names > short names. `getChangedFiles()` > `gcf()`

## Pull Request Guidelines

- **One thing per PR** — don't mix bug fixes with features
- **Describe the why** — not just what you changed, but why it matters
- **Keep it small** — smaller PRs get reviewed faster
- **Tests for behavior changes** — if it changes what the user sees, test it
- **No breaking changes** without discussion first

## Running the GitHub Action Locally

```bash
# Build first
npm run build

# Simulate what the action does
CODEGOAT_API_KEY=sk-... NO_COLOR=1 node dist/cli.js review . --format markdown
```

## Questions?

Open a [discussion](../../discussions) or comment on the issue you're working on. We don't bite. 🐐
