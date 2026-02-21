# codegoat review — Architecture

## End-to-End Flow

```
codegoat review <path>
  │
  ├─ 1. File Discovery
  │     - Walk the directory tree from <path>
  │     - Respect .gitignore (use `ignore` npm package)
  │     - Filter to supported extensions: .ts, .tsx, .js, .jsx, .mjs, .cjs
  │     - Skip: node_modules/, dist/, .git/, lockfiles, binaries, files > 50KB
  │
  ├─ 2. File Selection & Budgeting
  │     - Collect file paths + sizes
  │     - Sort by size ascending (review small files first = more coverage)
  │     - Pack files into a context window budget (default: 100K tokens)
  │     - If over budget: truncate file list, warn user which files were skipped
  │
  ├─ 3. Prompt Assembly
  │     - System prompt: "You are a code reviewer. Be direct, flag real issues, skip praise."
  │     - User prompt: file contents wrapped as ```<filename>\n<content>\n```
  │     - Append: "Review this code. Focus on bugs, security issues, unclear logic, and missing error handling. Be specific — reference file names and line numbers."
  │
  ├─ 4. LLM Call
  │     - Send to configured provider via unified adapter
  │     - Stream response to stdout (user sees output as it arrives)
  │
  └─ 5. Output
        - Print review as markdown to stdout
        - Exit 0 (review is advisory, never fails the process)
```

## LLM Configuration

**Environment variables (primary):**

```bash
# Required
CODEGOAT_API_KEY=sk-...

# Optional (defaults shown)
CODEGOAT_PROVIDER=openai        # openai | anthropic
CODEGOAT_MODEL=gpt-4o-mini      # model name for the provider
CODEGOAT_MAX_TOKENS=100000      # context budget for file content
```

**Why env vars over config file:** Simpler for CI, simpler for quick use, no file to manage. Config file can come later if users ask for it.

**Key validation:** On startup, check that `CODEGOAT_API_KEY` is set. If not, print a clear error with setup instructions and exit 1.

## Provider Abstraction

```typescript
// src/providers/types.ts
interface LLMProvider {
  name: string;
  chat(request: ChatRequest): AsyncIterable<string>;
}

interface ChatRequest {
  system: string;
  messages: { role: "user"; content: string }[];
  maxTokens?: number;
}
```

**First provider: OpenAI** — widest adoption, cheapest models (gpt-4o-mini), simplest API. The `LLMProvider` interface keeps the door open for Anthropic next.

**Implementation:** One file per provider (`src/providers/openai.ts`). Factory function picks provider based on `CODEGOAT_PROVIDER` env var.

## Output Format

Plain markdown printed to stdout:

```markdown
## Review: <path>

**Files reviewed:** 12 of 15 (3 skipped — over token budget)

### src/auth.ts

- **Bug (line 23):** `token` can be undefined here but is used without a null check on line 25.
- **Security (line 41):** Password is logged in plaintext. Remove `console.log(password)`.

### src/api.ts

- **Style (line 8-12):** This try/catch swallows errors silently. At minimum, log the error.

### Summary

3 issues found: 1 bug, 1 security, 1 style.
```

**Design choices:**
- Markdown because it renders nicely in terminals, CI logs, and PR comments
- Categorize issues: Bug, Security, Performance, Style, Clarity
- Always include file name + line number
- End with a summary count

## Handling Large Repos

| Problem | Solution |
|---------|----------|
| Too many files | Filter by extension, respect .gitignore, skip known junk dirs |
| Single huge file (> 50KB) | Skip it, warn user |
| Total content > token budget | Pack files until budget is full, skip the rest with a warning |
| Token counting | Estimate at 4 chars ≈ 1 token (good enough for budgeting, no tokenizer dep) |

**Future:** Support `--include` / `--exclude` glob flags for manual control. Support `--max-tokens` flag to override budget.

## Project Structure

```
src/
  cli.ts              # Entry point, commander setup
  commands/
    review.ts         # Review command logic
  providers/
    types.ts          # LLMProvider interface
    openai.ts         # OpenAI implementation
    factory.ts        # Provider selection
  files/
    discover.ts       # File walking + filtering
    budget.ts         # Token budgeting + file packing
  output/
    formatter.ts      # Format LLM response for terminal
```

## What's NOT in v0.1

- Config file support
- Anthropic/local model providers
- PR-mode (diff-only review)
- GitHub Action
- Caching
- Custom rule/prompt configuration

These are all reasonable next steps but we ship without them first.

---

_Last updated: 2026-02-21_
