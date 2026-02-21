# Quick Start

Get your first AI code review in 60 seconds.

## Prerequisites

- **Node.js 20+** — [download](https://nodejs.org)
- **An LLM API key** — [OpenAI](https://platform.openai.com/api-keys) or [Anthropic](https://console.anthropic.com/)

## Step 1: Set your API key

```bash
export CODEGOAT_API_KEY=sk-...
```

> 💡 Add this to your `~/.bashrc` or `~/.zshrc` so it persists across sessions.

## Step 2: Run a review

```bash
# Review the current directory
npx codegoat review .
```

That's it. No install, no account, no config file.

## What you'll see

```
🐐 codegoat review — src/

Reviewing 8 files (2,140 lines)...

## Summary

Express API with good structure. 2 issues found, 1 suggestion.

### src/routes/auth.ts
🔴 critical — Password comparison uses === instead of crypto.timingSafeEqual()

### src/middleware/rateLimit.ts
🟡 warning — Rate limit counter resets on restart (in-memory store)

### src/utils/validate.ts
🔵 info — Consider using zod for schema validation instead of manual regex

Score: 7/10
```

## Next steps

- **Choose a different model:** `codegoat review . --model gpt-4o`
- **Use Anthropic:** `codegoat review . --provider anthropic` → [Provider guide](providers.md)
- **Review only your changes:** `codegoat review --diff` → [Examples](examples.md)
- **Set up CI:** Add the GitHub Action → [CI/CD guide](ci-cd.md)
- **Customize:** Add rules for your project → [Configuration](configuration.md)

## Install globally (optional)

If you use codegoat regularly:

```bash
npm install -g codegoat
codegoat review .
```

## Troubleshooting

### "CODEGOAT_API_KEY is required"

You need to set your API key:

```bash
export CODEGOAT_API_KEY=sk-...
```

### "No supported files found"

codegoat currently supports: `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.py`, `.go`

Make sure you're pointing at a directory with supported files:

```bash
codegoat review ./src
```

### "Rate limit exceeded"

Your LLM provider's rate limit, not ours. Options:
- Wait a moment and retry
- Use a cheaper/faster model: `--model gpt-4o-mini`
- Reduce token budget: `--budget 50000`
