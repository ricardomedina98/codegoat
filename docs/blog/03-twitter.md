# Twitter/X Thread — 5 tweets

## Tweet 1 (hook)

🐐 codegoat v1.0 is out — open-source AI code review from your terminal.

```
npx codegoat review .
```

Free. Local-first. Bring your own LLM.

8 languages. GitHub + GitLab CI. Inline PR comments.

🔗 github.com/opengoat/codegoat

🧵 Here's what it does ↓

## Tweet 2 (the problem)

AI code review tools charge $20-30/dev/month and require sending your code to their servers.

For a team of 5, that's $1,800/year.

codegoat uses your own API key. Same AI reviews. ~$3/month.

With Ollama (local models): $0/month and your code never leaves your machine.

## Tweet 3 (features)

What's in v1.0:

🔍 Review — finds bugs, security issues, missing tests
📝 Docs — generates documentation from code
🔀 Diff — review only changed files before you push
🤖 CI — inline PR comments on GitHub + GitLab
⚡ Cache — unchanged files skip the LLM
👀 Watch — reviews files as you save

## Tweet 4 (demo output)

Here's what codegoat catches in a real codebase:

🔴 SQL injection via string concatenation
🔴 Hardcoded JWT secret
🟡 HTTP request with no timeout
🟡 Bare except swallowing all errors
🔵 Overly permissive email regex

All with file + line number. In CI, it posts these as inline comments on your PR.

Demo repo: github.com/ricardomedina98/codegoat-demo

## Tweet 5 (CTA)

Try it in 30 seconds:

```
export CODEGOAT_API_KEY=sk-...
npx codegoat review .
```

Works with OpenAI, Anthropic, or Ollama.
JS/TS, Python, Go, Ruby, Java, Rust.

⭐ Star if useful: github.com/opengoat/codegoat
📖 Docs: github.com/opengoat/codegoat/tree/main/docs

MIT licensed — fork it, extend it, ship it.
