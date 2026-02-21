# Hacker News — Show HN Post

**Title:** Show HN: Codegoat – Open-source AI code review CLI (bring your own LLM, runs locally)

**URL:** https://github.com/opengoat/codegoat

**Text:**

Hi HN,

We built codegoat — an open-source CLI for AI-powered code review. You bring your own API key (OpenAI, Anthropic, or Ollama for fully local), and it reviews your code from the terminal.

Why we built it: The AI code review market is entirely SaaS — CodeRabbit ($30/seat/mo), Sourcery ($24/dev/mo), etc. They all require sending your code to their servers. We wanted something that runs locally, lets you pick your model, and doesn't cost a monthly fee per developer.

What it does:

- `npx codegoat review .` — reviews a codebase with severity-rated findings (critical/warning/info/style)
- `codegoat review --diff main` — reviews only changed files (for pre-push checks)
- `codegoat docs ./src` — generates documentation from code
- Ships with GitHub Action and GitLab CI integration for inline PR/MR comments
- `.codegoatrc` for per-project rules and LLM context
- Caching system so unchanged files aren't re-reviewed
- 8 languages: JS/TS, Python, Go, Ruby, Java, Rust

The typical cost per review is $0.005–0.10 depending on codebase size and model. A team of 5 doing 20 reviews/week spends ~$3/month vs $150/month for CodeRabbit.

Architecture is straightforward: file discovery → token budgeting → LLM call → structured findings → output formatting. The CI adapters handle platform-specific comment APIs (GitHub Reviews API, GitLab Discussions API). Everything is TypeScript, no runtime dependencies beyond the LLM client.

Known limitations:
- Review quality depends on the model — gpt-4o-mini is surprisingly good for the price, but local models (7B params) lag behind
- 8 languages, not "every language" — adding new ones is mostly adding file extensions + prompt tuning
- No IDE integration yet (just CLI and CI)

MIT licensed. We've been using it daily on our own repos for the past few months.

Demo repo with intentional bugs so you can see the output: https://github.com/ricardomedina98/codegoat-demo

Happy to answer questions about the architecture, prompt engineering, or LLM provider tradeoffs.
