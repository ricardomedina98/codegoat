# VS Code Extension README

## 🐐 codegoat — AI Code Review, Fix & Test

AI-powered code quality in your editor. Reviews your code, suggests fixes, and generates tests — powered by the LLM of your choice.

### Features

- **Inline diagnostics** — Findings appear as squiggly underlines with severity colors
- **Quick Fix** — Click 💡 to apply AI-generated fixes directly
- **Generate tests** — Right-click a file → "Codegoat: Generate Tests"
- **Review on command** — Command palette: "Codegoat: Review Current File"
- **Severity filtering** — Choose what severity level to show

### The Workflow

```
Review → see diagnostics → Quick Fix → apply fix → Generate Tests
```

All from your editor. No terminal needed.

### Commands

| Command | Description |
|---------|-------------|
| `Codegoat: Review Current File` | Run AI review on the active file |
| `Codegoat: Review Workspace` | Review all supported files |
| `Codegoat: Review Changed Files` | Review git-modified files |
| `Codegoat: Fix Current File` | Generate fixes for findings |
| `Codegoat: Generate Tests` | Generate tests for the active file |
| `Codegoat: Set API Key` | Configure your LLM API key |

### Severity Levels

| Icon | Level | VS Code mapping |
|------|-------|----------------|
| 🔴 | critical | Error (red underline) |
| 🟡 | warning | Warning (yellow underline) |
| 🔵 | info | Information (blue underline) |
| ⚪ | style | Hint (grey dots) |

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `codegoat.provider` | `openai` | LLM provider |
| `codegoat.model` | `gpt-4o-mini` | Model name |
| `codegoat.severity` | `info` | Minimum severity to show |
| `codegoat.reviewOnSave` | `false` | Review when you save |

### Requirements

- [codegoat CLI](https://github.com/opengoat/codegoat) installed (`npm install -g codegoat`)
- An LLM API key (OpenAI, Anthropic, or Ollama for local)

### Privacy

The extension wraps the codegoat CLI. Your code is sent to your configured LLM provider. With Ollama, nothing leaves your machine. No telemetry, no tracking.

### Links

- [GitHub](https://github.com/opengoat/codegoat)
- [Documentation](https://github.com/opengoat/codegoat/tree/main/docs)
- [CLI README](https://github.com/opengoat/codegoat#readme)
