import type { LLMProvider } from "./types.js";
import { OpenAIProvider } from "./openai.js";
import { AnthropicProvider } from "./anthropic.js";
import { OllamaProvider } from "./ollama.js";
import { GeminiProvider } from "./gemini.js";

export function createProvider(name?: string): LLMProvider {
  const providerName = name ?? process.env.CODEGOAT_PROVIDER ?? "openai";

  // Ollama and Gemini don't need CODEGOAT_API_KEY (Gemini uses GOOGLE_API_KEY)
  if (providerName === "ollama") {
    return new OllamaProvider();
  }
  if (providerName === "gemini") {
    return new GeminiProvider();
  }

  if (!process.env.CODEGOAT_API_KEY) {
    console.error(
      "❌ CODEGOAT_API_KEY is not set.\n" +
        "Set it with: export CODEGOAT_API_KEY=<your-api-key>"
    );
    process.exit(2);
  }

  switch (providerName) {
    case "openai":
      return new OpenAIProvider();
    case "anthropic":
      return new AnthropicProvider();
    default:
      throw new Error(
        `Unknown provider "${providerName}". Supported providers: openai, anthropic, ollama, gemini`
      );
  }
}
