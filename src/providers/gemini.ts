import type { ChatRequest, LLMProvider } from "./types.js";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor() {
    const key = process.env.GOOGLE_API_KEY ?? process.env.CODEGOAT_API_KEY;
    if (!key) {
      throw new Error(
        "GOOGLE_API_KEY (or CODEGOAT_API_KEY) is not set. " +
          "Get a free key at https://aistudio.google.com/apikey"
      );
    }
    this.apiKey = key;
    this.defaultModel = process.env.CODEGOAT_MODEL || "gemini-2.0-flash";
  }

  async *chat(request: ChatRequest): AsyncIterable<string> {
    const model = request.model ?? this.defaultModel;

    // Convert OpenAI-style messages to Gemini format
    // Gemini uses systemInstruction + contents
    const systemParts: string[] = [];
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    for (const msg of request.messages) {
      if (msg.role === "system") {
        systemParts.push(msg.content);
      } else {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }
    }

    const body: any = { contents };
    if (systemParts.length > 0) {
      body.systemInstruction = { parts: systemParts.map(text => ({ text })) };
    }
    if (request.maxTokens) {
      body.generationConfig = { maxOutputTokens: request.maxTokens };
    }

    if (request.stream !== false) {
      yield* this.streamChat(model, body);
    } else {
      yield* this.nonStreamChat(model, body);
    }
  }

  private async *streamChat(model: string, body: any): AsyncIterable<string> {
    const url = `${GEMINI_ENDPOINT}/${model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}\n${errText}`);
    }

    if (!response.body) throw new Error("No response body from Gemini API");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (!data || data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) yield text;
        } catch {
          // Skip unparseable chunks
        }
      }
    }

    // Process remaining buffer
    if (buffer.startsWith("data: ")) {
      const data = buffer.slice(6).trim();
      if (data && data !== "[DONE]") {
        try {
          const parsed = JSON.parse(data);
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) yield text;
        } catch { /* skip */ }
      }
    }
  }

  private async *nonStreamChat(model: string, body: any): AsyncIterable<string> {
    const url = `${GEMINI_ENDPOINT}/${model}:generateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}\n${errText}`);
    }

    const data: any = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) yield text;
  }
}
