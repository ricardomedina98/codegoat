import type { LLMProvider } from "./types.js";
import { OpenAIProvider } from "./openai.js";
import { AnthropicProvider } from "./anthropic.js";
import { OllamaProvider } from "./ollama.js";
import { GeminiProvider } from "./gemini.js";
import { AzureOpenAIProvider } from "./azure.js";
import { BedrockProvider } from "./bedrock.js";

export function createProvider(name?: string, model?: string): LLMProvider {
  const providerName = name ?? process.env.CODEGOAT_PROVIDER ?? "openai";

  // Providers with their own auth (no CODEGOAT_API_KEY needed)
  if (providerName === "ollama") {
    return new OllamaProvider();
  }
  if (providerName === "gemini") {
    return new GeminiProvider();
  }
  if (providerName === "azure") {
    return new AzureOpenAIProvider(model);
  }
  if (providerName === "bedrock") {
    return new BedrockProvider(model);
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
        `Unknown provider "${providerName}". Supported providers: openai, anthropic, ollama, gemini, azure, bedrock`
      );
  }
}
