import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createProvider } from "../src/providers/factory.js";

describe("createProvider", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Save env
    for (const key of ["CODEGOAT_API_KEY", "CODEGOAT_PROVIDER", "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_KEY", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"]) {
      savedEnv[key] = process.env[key];
    }
  });

  afterEach(() => {
    // Restore env
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  });

  it("creates openai provider", () => {
    process.env.CODEGOAT_API_KEY = "test-key";
    const p = createProvider("openai");
    assert.equal(p.name, "openai");
  });

  it("creates anthropic provider", () => {
    process.env.CODEGOAT_API_KEY = "test-key";
    const p = createProvider("anthropic");
    assert.equal(p.name, "anthropic");
  });

  it("creates ollama provider without API key", () => {
    delete process.env.CODEGOAT_API_KEY;
    const p = createProvider("ollama");
    assert.equal(p.name, "ollama");
  });

  it("creates gemini provider", () => {
    process.env.GOOGLE_API_KEY = "test-key";
    const p = createProvider("gemini");
    assert.equal(p.name, "gemini");
  });

  it("creates azure provider", () => {
    process.env.AZURE_OPENAI_ENDPOINT = "https://myinstance.openai.azure.com";
    process.env.AZURE_OPENAI_KEY = "test-key";
    const p = createProvider("azure");
    assert.equal(p.name, "azure");
  });

  it("azure provider requires endpoint", () => {
    delete process.env.AZURE_OPENAI_ENDPOINT;
    process.env.AZURE_OPENAI_KEY = "test-key";
    assert.throws(() => createProvider("azure"), /AZURE_OPENAI_ENDPOINT/);
  });

  it("azure provider requires key", () => {
    process.env.AZURE_OPENAI_ENDPOINT = "https://myinstance.openai.azure.com";
    delete process.env.AZURE_OPENAI_KEY;
    delete process.env.CODEGOAT_API_KEY;
    assert.throws(() => createProvider("azure"), /AZURE_OPENAI_KEY/);
  });

  it("creates bedrock provider", () => {
    process.env.AWS_ACCESS_KEY_ID = "AKID";
    process.env.AWS_SECRET_ACCESS_KEY = "secret";
    const p = createProvider("bedrock");
    assert.equal(p.name, "bedrock");
  });

  it("bedrock provider requires AWS credentials", () => {
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    assert.throws(() => createProvider("bedrock"), /AWS_ACCESS_KEY_ID/);
  });

  it("throws on unknown provider", () => {
    process.env.CODEGOAT_API_KEY = "test-key";
    assert.throws(() => createProvider("nonexistent"), /Unknown provider/);
  });
});
