# Provider Setup

codegoat works with multiple LLM providers. You bring the API key, you choose the model.

## OpenAI (default)

The default provider. Best balance of speed, quality, and cost.

### Setup

1. Get an API key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Set the environment variable:

```bash
export CODEGOAT_API_KEY=sk-...
```

3. Run:

```bash
codegoat review .
```

### Models

| Model | Speed | Quality | Cost | Best for |
|-------|-------|---------|------|----------|
| `gpt-4o-mini` (default) | ⚡⚡⚡ | ★★★ | ~$0.01/review | Daily reviews, CI |
| `gpt-4o` | ⚡⚡ | ★★★★ | ~$0.05/review | Thorough reviews, complex code |
| `gpt-4.1` | ⚡⚡ | ★★★★★ | ~$0.10/review | Critical code, security audits |

```bash
# Use a specific model
codegoat review . --model gpt-4o
```

> 💡 Costs are approximate for a ~5,000 line codebase. Your costs depend on codebase size and token budget.

---

## Anthropic Claude

Great for nuanced reviews — Claude tends to explain the "why" behind suggestions.

### Setup

1. Get an API key at [console.anthropic.com](https://console.anthropic.com/)
2. Set the environment variable:

```bash
export CODEGOAT_API_KEY=sk-ant-...
export CODEGOAT_PROVIDER=anthropic
```

3. Run:

```bash
codegoat review .

# Or use the flag (no need for env var)
codegoat review . --provider anthropic
```

### Models

| Model | Speed | Quality | Cost | Best for |
|-------|-------|---------|------|----------|
| `claude-3-haiku-20240307` (default) | ⚡⚡⚡ | ★★★ | ~$0.005/review | Fast CI reviews |
| `claude-sonnet-4-20250514` | ⚡⚡ | ★★★★ | ~$0.03/review | Daily reviews |
| `claude-opus-4-20250514` | ⚡ | ★★★★★ | ~$0.15/review | Deep reviews |

```bash
codegoat review . --provider anthropic --model claude-sonnet-4-20250514
```

---

## Ollama (local models)

Run reviews without sending code anywhere. Completely private.

### Setup

1. Install Ollama: [ollama.ai](https://ollama.ai)
2. Pull a model:

```bash
ollama pull codellama
# or
ollama pull deepseek-coder:6.7b
```

3. Run:

```bash
codegoat review . --provider ollama --model codellama
```

### Models

| Model | RAM needed | Quality | Best for |
|-------|-----------|---------|----------|
| `codellama` | 4GB | ★★ | Quick local reviews |
| `deepseek-coder:6.7b` | 6GB | ★★★ | Good balance |
| `deepseek-coder:33b` | 20GB | ★★★★ | Quality close to GPT-4o |

> ⚠️ Local model quality varies. For critical reviews, cloud models still produce better results. But for privacy-sensitive code or offline work, local models are the way to go.

### Custom Ollama endpoint

If Ollama runs on a different host:

```bash
export CODEGOAT_OLLAMA_URL=http://192.168.1.100:11434
codegoat review . --provider ollama
```

---

## Switching providers

You can switch anytime — per command, per project, or per environment:

```bash
# Per command
codegoat review . --provider anthropic --model claude-sonnet-4-20250514

# Per project (.codegoatrc)
# provider: anthropic
# model: claude-sonnet-4-20250514

# Per environment
export CODEGOAT_PROVIDER=anthropic
export CODEGOAT_MODEL=claude-sonnet-4-20250514
```

### Precedence

```
CLI flags > environment variables > .codegoatrc > defaults
```

---

## Cost comparison

Approximate cost per review of a 5,000-line codebase:

| Provider + Model | Cost/review | 100 reviews/month |
|------------------|-------------|-------------------|
| OpenAI gpt-4o-mini | $0.01 | **$1** |
| Anthropic Haiku | $0.005 | **$0.50** |
| OpenAI gpt-4o | $0.05 | **$5** |
| Anthropic Sonnet | $0.03 | **$3** |
| Ollama (local) | $0.00 | **$0** |
| CodeRabbit (competitor) | — | **$30/dev** |
| Sourcery (competitor) | — | **$24/dev** |

Your API key, your costs, your choice.
