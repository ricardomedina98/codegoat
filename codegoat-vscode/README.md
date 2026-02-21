# 🐐 codegoat for VS Code

AI-powered code review directly in your editor. Powered by the [codegoat CLI](https://github.com/ricardomedina98/codegoat).

## Features

- **Review current file** — Run AI code review on the active file
- **Review workspace** — Scan the entire project
- **Inline diagnostics** — Findings appear as squiggly underlines with severity colors
- **Gutter icons** — Error (🔴), Warning (🟡), Info (🔵), Hint (⚪)
- **Status bar** — Shows review status and finding counts
- **Review on save** — Optional auto-review when you save (off by default)

## Prerequisites

Install the codegoat CLI:

```bash
npm install -g codegoat
```

Set your API key:

```bash
export CODEGOAT_API_KEY=<your-key>
```

## Commands

| Command | Description |
|---------|-------------|
| `Codegoat: Review Current File` | Review the active file |
| `Codegoat: Review Workspace` | Review entire workspace |
| `Codegoat: Clear Diagnostics` | Clear all codegoat findings |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `codegoat.provider` | `openai` | LLM provider (openai, anthropic, ollama, gemini) |
| `codegoat.model` | `""` | Model name (empty = provider default) |
| `codegoat.severity` | `info` | Minimum severity to show |
| `codegoat.reviewOnSave` | `false` | Auto-review on file save |
| `codegoat.cliPath` | `codegoat` | Path to CLI binary |

## How It Works

The extension is a thin wrapper around the codegoat CLI:

1. Runs `codegoat review --format json --quiet`
2. Parses the JSON output (findings with file, line, severity, message)
3. Maps findings to VS Code Diagnostics
4. Shows results inline in the editor

No core logic in the extension — all review intelligence comes from the CLI.

## Development

```bash
cd codegoat-vscode
npm install
npm run build
```

Then press F5 in VS Code to launch the Extension Development Host.
