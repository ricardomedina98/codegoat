---
title: "Building an open-source AI code reviewer — what we learned"
published: true
description: "How we built codegoat, a free CLI for AI code review. Architecture decisions, prompt engineering, and why we think code review should be free."
tags: opensource, ai, codereview, typescript
cover_image: # TODO: add cover image URL
---

# Building an open-source AI code reviewer — what we learned

We just released [codegoat v1.0](https://github.com/opengoat/codegoat) — a free, open-source CLI for AI-powered code review. This post is about what we built, why, and what we learned along the way.

## The problem

I use AI code review tools. They're useful. But they all share the same model:

- **SaaS-only** — your code goes to their servers
- **$20-30/developer/month** — adds up fast for small teams
- **Vendor lock-in** — you can't choose your LLM
- **No CLI** — you can only use them through PRs, not locally

As a solo developer working on client projects, I wanted to review my code *before* pushing it. And I didn't want to send client code to a third-party service.

So we built codegoat.

## What codegoat does

```bash
# Install nothing — just run it
export CODEGOAT_API_KEY=sk-...
npx codegoat review .
```

Output:

```
🐐 codegoat review — src/

12 files reviewed · 🔴 2 critical · 🟡 3 warnings · 🔵 2 info

### src/routes/auth.ts
🔴 critical — Line 42: Password comparison uses === instead of
   crypto.timingSafeEqual(). Vulnerable to timing attacks.

🔴 critical — Line 8: JWT secret hardcoded as string literal.

### src/services/payment.ts
🟡 warning — Line 89: No error handling for network timeout.

Score: 5/10
```

It also does:
- **Diff reviews**: `codegoat review --diff main` — only reviews changed files
- **Doc generation**: `codegoat docs ./src` — generates documentation
- **CI integration**: GitHub Actions + GitLab CI with inline PR comments
- **Watch mode**: Reviews files as you save them

## Architecture

The architecture is simple — intentionally so.

```
CLI entry → File discovery → Token budgeting → LLM call → Finding parser → Output
```

### File discovery

We walk the directory tree, respect `.gitignore` and `.codegoatignore`, filter by supported extensions (8 languages), skip binaries and files over 50KB. We use the `ignore` npm package — same engine as git.

### Token budgeting

LLMs have context limits and cost money per token. We sort files smallest-first, include as many as fit in the budget (default 100K tokens), and skip the rest. This means small utility files always get reviewed, and large generated files get skipped.

### The LLM call

We support three providers:

| Provider | Best model | Cost/review | Privacy |
|----------|-----------|-------------|---------|
| OpenAI | gpt-4o-mini | ~$0.01 | Cloud |
| Anthropic | Claude Haiku | ~$0.005 | Cloud |
| Ollama | codellama/deepseek | $0 | **Fully local** |

The prompt is the core of the product. We ask the LLM to:
1. Review each file for bugs, security issues, and improvements
2. Categorize each finding by severity (critical/warning/info/style)
3. Include the file path and line number
4. Provide a summary and overall score

### Severity system

Four levels, inspired by linting tools:

- 🔴 **critical** — bugs, security vulnerabilities, crashes
- 🟡 **warning** — likely problems, missing error handling
- 🔵 **info** — suggestions, refactoring opportunities
- ⚪ **style** — cosmetic, naming conventions

You filter with `--severity warning` (shows warning + critical, hides info + style).

For CI, `--fail-on critical` exits with code 1 when critical issues are found.

### Caching

The most impactful optimization. We hash each file's content + the config (model, rules, context). If nothing changed, we skip the LLM call entirely. On a 50-file repo where 5 files changed, we save ~90% of tokens and time.

Cache lives in `.codegoat-cache/` (auto-added to .gitignore).

### CI adapters

The CI layer is an abstraction over platform-specific APIs:

```typescript
interface CIAdapter {
  detect(): boolean;
  getDiff(): Promise<DiffResult>;
  postReview(findings: Finding[], summary: string): Promise<void>;
  dismissPrevious(): Promise<void>;
}
```

GitHub uses the Reviews API (one API call for all inline comments). GitLab uses the Discussions API (one call per comment). Both auto-detect from CI environment variables.

## What we learned

### 1. Prompt engineering is the product

The difference between "useless AI review" and "actually helpful feedback" is 90% prompt engineering. Key learnings:

- **Tell the LLM to be conservative with "critical"** — false alarms destroy trust
- **Provide project context** — "this is a fintech app, money is in cents" changes the review quality dramatically
- **Structured output** — asking for `[severity] file:line — message` format makes parsing reliable
- **Custom rules work** — injecting project-specific rules ("always use parameterized SQL") catches domain-specific issues that generic reviews miss

### 2. gpt-4o-mini is surprisingly good

We expected to need GPT-4o or Claude Sonnet for quality reviews. Turns out gpt-4o-mini catches ~80% of what the larger models catch, at 1/10th the cost. For daily reviews, it's the sweet spot.

Local models (7B) are noticeably worse — they miss subtle bugs and sometimes hallucinate line numbers. But for privacy-sensitive code or offline work, they're better than nothing.

### 3. Caching matters more than model quality

The biggest UX improvement wasn't a better model — it was caching. Going from 30s to 8s on repeat reviews made the difference between "I'll run this sometimes" and "I run this before every commit."

### 4. Inline PR comments > summary comments

Our first CI integration posted a single comment with the full review. Users skimmed it. When we switched to inline comments on specific lines, engagement went up dramatically. The finding appears right next to the code — no context switching.

### 5. Configuration is a feature, not a burden

We resisted `.codegoatrc` for a while — "zero config" felt right. But power users immediately asked for custom rules and per-project settings. The key was making config 100% optional while making it powerful when used.

## Cost comparison

This is the part that surprises people:

| Setup | Monthly cost (team of 5) |
|-------|--------------------------|
| codegoat + gpt-4o-mini | **~$3** |
| codegoat + Ollama | **$0** |
| CodeRabbit | $150 |
| Sourcery | $120 |
| GitHub Copilot CR | $50-195 |

The economics work because you pay per-token, not per-seat. A typical review costs $0.005-0.10 depending on codebase size and model.

## Try it

```bash
export CODEGOAT_API_KEY=sk-...
npx codegoat review .
```

- **GitHub:** [github.com/opengoat/codegoat](https://github.com/opengoat/codegoat)
- **Demo repo:** [github.com/ricardomedina98/codegoat-demo](https://github.com/ricardomedina98/codegoat-demo)
- **Docs:** [github.com/opengoat/codegoat/tree/main/docs](https://github.com/opengoat/codegoat/tree/main/docs)

MIT licensed. Contributions welcome — especially new languages and prompt improvements.

---

*What's your experience with AI code review tools? Would you use something like this? We'd love feedback in the [issues](https://github.com/opengoat/codegoat/issues) or comments below.*
