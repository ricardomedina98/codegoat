import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OllamaProvider } from "../src/providers/ollama.js";

describe("OllamaProvider", () => {
  it("has name 'ollama'", () => {
    const provider = new OllamaProvider();
    assert.equal(provider.name, "ollama");
  });

  it("parses Ollama NDJSON stream correctly", async () => {
    const provider = new OllamaProvider();
    const ndjson = [
      '{"message":{"role":"assistant","content":"Hello"},"done":false}',
      '{"message":{"role":"assistant","content":" world"},"done":false}',
      '{"message":{"role":"assistant","content":""},"done":true}',
      "",
    ].join("\n");

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(ndjson));
        controller.close();
      },
    });

    const chunks: string[] = [];
    for await (const chunk of (provider as any).parseStream(stream)) {
      chunks.push(chunk);
    }
    assert.deepEqual(chunks, ["Hello", " world"]);
  });

  it("throws on non-200 response", async () => {
    const provider = new OllamaProvider();
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => new Response("model not found", { status: 404 });
      const iter = provider.chat({ messages: [{ role: "user", content: "test" }] });
      await assert.rejects(async () => {
        for await (const _ of iter) { /* consume */ }
      }, /Ollama API error \(404\)/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws helpful error on connection refused", async () => {
    const provider = new OllamaProvider();
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => { throw new Error("fetch failed"); };
      const iter = provider.chat({ messages: [{ role: "user", content: "test" }] });
      await assert.rejects(async () => {
        for await (const _ of iter) { /* consume */ }
      }, /Is Ollama running/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
