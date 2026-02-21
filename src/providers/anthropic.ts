import type { ChatRequest, LLMProvider } from "./types.js";

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor() {
    const key = process.env.CODEGOAT_API_KEY;
    if (!key) {
      throw new Error(
        "CODEGOAT_API_KEY environment variable is not set. " +
          "Please set it to your Anthropic API key."
      );
    }
    this.apiKey = key;
    this.defaultModel = process.env.CODEGOAT_MODEL || "claude-3-haiku-20240307";
  }

  async *chat(request: ChatRequest): AsyncIterable<string> {
    // Anthropic uses a separate system param, not a system message in messages array
    const systemContent = request.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");

    const messages = request.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const body: Record<string, unknown> = {
      model: request.model ?? this.defaultModel,
      max_tokens: request.maxTokens ?? 4096,
      messages,
      stream: true,
    };

    if (systemContent) {
      body.system = systemContent;
    }

    let response: Response;
    try {
      response = await fetch(ANTHROPIC_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new Error(
        `Network error connecting to Anthropic: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "unknown error");
      throw new Error(`Anthropic API error (${response.status}): ${text}`);
    }

    if (!response.body) {
      throw new Error("Anthropic response has no body");
    }

    yield* this.parseSSEStream(response.body);
  }

  private async *parseSSEStream(
    body: ReadableStream<Uint8Array>
  ): AsyncIterable<string> {
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

        try {
          const parsed = JSON.parse(data) as {
            type: string;
            delta?: { type: string; text?: string };
          };

          if (parsed.type === "message_stop") return;

          if (
            parsed.type === "content_block_delta" &&
            parsed.delta?.type === "text_delta" &&
            parsed.delta.text
          ) {
            yield parsed.delta.text;
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }

    // Process remaining buffer
    const trimmed = buffer.trim();
    if (trimmed && trimmed.startsWith("data: ")) {
      try {
        const parsed = JSON.parse(trimmed.slice(6)) as {
          type: string;
          delta?: { type: string; text?: string };
        };
        if (
          parsed.type === "content_block_delta" &&
          parsed.delta?.type === "text_delta" &&
          parsed.delta.text
        ) {
          yield parsed.delta.text;
        }
      } catch {
        // Skip malformed JSON
      }
    }
  }
}
