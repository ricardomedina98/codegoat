import type { LLMProvider } from "./types.js";
import { OpenAIProvider } from "./openai.js";

export function createProvider(name?: string): LLMProvider {
  const providerName = name ?? process.env.CODEGOAT_PROVIDER ?? "openai";

  if (!process.env.CODEGOAT_API_KEY) {
    console.error(
      "Error: CODEGOAT_API_KEY is not set.\n" +
        "Set it with: export CODEGOAT_API_KEY=<your-api-key>"
    );
    process.exit(1);
  }

  switch (providerName) {
    case "openai":
      return new OpenAIProvider();
    default:
      throw new Error(
        `Unknown provider "${providerName}". Supported providers: openai`
      );
  }
}
