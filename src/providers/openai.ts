import type { ChatRequest, LLMProvider } from "./types.js";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor() {
    const key = process.env.CODEGOAT_API_KEY;
    if (!key) {
      throw new Error(
        "CODEGOAT_API_KEY environment variable is not set. " +
          "Please set it to your OpenAI API key."
      );
    }
    this.apiKey = key;
    this.defaultModel = process.env.CODEGOAT_MODEL || "gpt-4o-mini";
  }

  async *chat(request: ChatRequest): AsyncIterable<string> {
    const body = {
      model: request.model ?? this.defaultModel,
      messages: request.messages,
      max_tokens: request.maxTokens,
      stream: true,
    };

    let response: Response;
    try {
      response = await fetch(OPENAI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new Error(
        `Network error connecting to OpenAI: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "unknown error");
      throw new Error(
        `OpenAI API error (${response.status}): ${text}`
      );
    }

    if (!response.body) {
      throw new Error("OpenAI response has no body");
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
        if (data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data) as {
            choices: Array<{ delta: { content?: string } }>;
          };
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }

    // Process any remaining data in the buffer
    const trimmed = buffer.trim();
    if (trimmed && trimmed.startsWith("data: ") && trimmed.slice(6) !== "[DONE]") {
      try {
        const parsed = JSON.parse(trimmed.slice(6)) as {
          choices: Array<{ delta: { content?: string } }>;
        };
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          yield content;
        }
      } catch {
        // Skip malformed JSON
      }
    }
  }
}
