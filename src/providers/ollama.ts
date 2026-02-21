import type { ChatRequest, LLMProvider } from "./types.js";

const DEFAULT_OLLAMA_URL = "http://localhost:11434";

export class OllamaProvider implements LLMProvider {
  readonly name = "ollama";
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor() {
    this.baseUrl = process.env.CODEGOAT_OLLAMA_URL ?? DEFAULT_OLLAMA_URL;
    this.defaultModel = process.env.CODEGOAT_MODEL || "codellama";
  }

  async *chat(request: ChatRequest): AsyncIterable<string> {
    const endpoint = `${this.baseUrl}/api/chat`;

    const body = {
      model: request.model ?? this.defaultModel,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
    };

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
        throw new Error(
          `Cannot connect to Ollama at ${this.baseUrl}. Is Ollama running?\n` +
            "Start it with: ollama serve\n" +
            "Install from: https://ollama.ai"
        );
      }
      throw new Error(`Network error connecting to Ollama: ${msg}`);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "unknown error");
      throw new Error(`Ollama API error (${response.status}): ${text}`);
    }

    if (!response.body) {
      throw new Error("Ollama response has no body");
    }

    yield* this.parseStream(response.body);
  }

  private async *parseStream(
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
        if (!trimmed) continue;

        try {
          const parsed = JSON.parse(trimmed) as {
            message?: { content?: string };
            done?: boolean;
          };

          if (parsed.done) return;
          if (parsed.message?.content) {
            yield parsed.message.content;
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim()) as {
          message?: { content?: string };
          done?: boolean;
        };
        if (parsed.message?.content && !parsed.done) {
          yield parsed.message.content;
        }
      } catch {
        // Skip
      }
    }
  }
}
