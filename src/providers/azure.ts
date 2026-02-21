import type { ChatRequest, LLMProvider } from "./types.js";

/**
 * Azure OpenAI provider.
 * Uses the same SSE streaming format as OpenAI but with Azure-specific endpoints.
 *
 * Env vars:
 *   AZURE_OPENAI_ENDPOINT — e.g. https://myinstance.openai.azure.com
 *   AZURE_OPENAI_KEY — API key
 *   AZURE_OPENAI_DEPLOYMENT — deployment name (fallback for model)
 *   AZURE_OPENAI_API_VERSION — API version (default: 2024-02-01)
 */
export class AzureOpenAIProvider implements LLMProvider {
  readonly name = "azure";
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly deployment: string;
  private readonly apiVersion: string;

  constructor(model?: string) {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    if (!endpoint) {
      throw new Error("AZURE_OPENAI_ENDPOINT is not set. Set it to your Azure OpenAI resource endpoint.");
    }
    const key = process.env.AZURE_OPENAI_KEY ?? process.env.CODEGOAT_API_KEY;
    if (!key) {
      throw new Error("AZURE_OPENAI_KEY (or CODEGOAT_API_KEY) is not set.");
    }

    this.endpoint = endpoint.replace(/\/$/, "");
    this.apiKey = key;
    this.deployment = model ?? process.env.AZURE_OPENAI_DEPLOYMENT ?? process.env.CODEGOAT_MODEL ?? "gpt-4o-mini";
    this.apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-02-01";
  }

  async *chat(request: ChatRequest): AsyncIterable<string> {
    const deployment = request.model ?? this.deployment;
    const url = `${this.endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${this.apiVersion}`;

    const body = {
      messages: request.messages,
      max_tokens: request.maxTokens,
      stream: true,
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": this.apiKey,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new Error(`Network error connecting to Azure OpenAI: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "unknown error");
      throw new Error(`Azure OpenAI API error (${response.status}): ${text}`);
    }

    if (!response.body) {
      throw new Error("Azure OpenAI response has no body");
    }

    yield* this.parseSSEStream(response.body);
  }

  private async *parseSSEStream(body: ReadableStream<Uint8Array>): AsyncIterable<string> {
    const decoder = new TextDecoder();
    let buffer = "";

    for await (const chunk of body) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(":")) continue;
        if (!trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        if (data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data) as {
            choices: Array<{ delta: { content?: string } }>;
          };
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch { /* skip malformed */ }
      }
    }
  }
}
