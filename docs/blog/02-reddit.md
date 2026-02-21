# Reddit r/programming Post

**Title:** We built an open-source AI code review CLI — free, local-first, bring your own LLM (v1.0 release)

**Body:**

Hey r/programming,

After a few months of development, we're releasing v1.0 of [codegoat](https://github.com/opengoat/codegoat) — a CLI tool for AI-powered code review.

**The short version:**

```bash
export CODEGOAT_API_KEY=sk-...
npx codegoat review .
```

That gives you a severity-rated code review (critical/warning/info/style) of your project. No account, no subscription, no sending code to a third-party service.

**Why we built this:**

Every AI code review tool out there is a SaaS product charging $20-30/developer/month. For a team of 5, that's $150/month minimum. They all require your code to pass through their servers.

We wanted:
1. Something that runs from the terminal, not from a browser
2. The ability to choose which LLM to use (and switch freely)
3. Our code to stay on our machines (especially for client projects)
4. A tool that's free for solo devs and students

**What v1.0 includes:**

- **8 languages** — JS/TS, Python, Go, Ruby, Java, Rust
- **3 LLM providers** — OpenAI, Anthropic, Ollama (local models)
- **Diff mode** — `codegoat review --diff main` reviews only changed files
- **Docs generation** — `codegoat docs ./src` generates documentation
- **CI integration** — GitHub Actions + GitLab CI with inline PR/MR comments
- **Severity system** — 4 levels, filterable, with CI fail conditions
- **Caching** — unchanged files skip the LLM on repeat reviews
- **Watch mode** — reviews files as you save them
- **Configuration** — `.codegoatrc` for project rules, `.codegoatignore` for exclusions

**Cost breakdown:**

| Setup | Monthly cost |
|-------|-------------|
| codegoat + gpt-4o-mini (team of 5) | ~$3 |
| codegoat + Ollama local | $0 |
| CodeRabbit (team of 5) | $150 |
| Sourcery (team of 5) | $120 |

**What it's not:**

- Not a replacement for human code review — it catches the mechanical stuff (bugs, security, missing tests) so humans can focus on architecture and logic
- Not an IDE plugin (yet) — it's CLI and CI only
- Not perfect — quality depends on the LLM. GPT-4o gives better reviews than 7B local models

**Demo repo** with intentional bugs: https://github.com/ricardomedina98/codegoat-demo

**Docs:** https://github.com/opengoat/codegoat/tree/main/docs

MIT licensed. We'd love feedback — especially on:
- Review quality for your language/framework
- Features you'd need to use it daily
- What we got wrong

GitHub: https://github.com/opengoat/codegoat
