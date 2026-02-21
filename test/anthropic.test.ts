import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { AnthropicProvider } from "../src/providers/anthropic.js";

describe("AnthropicProvider", () => {
  it("throws when API key is not set", () => {
    const saved = process.env.CODEGOAT_API_KEY;
    delete process.env.CODEGOAT_API_KEY;
    try {
      assert.throws(() => new AnthropicProvider(), /CODEGOAT_API_KEY/);
    } finally {
      if (saved) process.env.CODEGOAT_API_KEY = saved;
    }
  });

  it("has name 'anthropic'", () => {
    const saved = process.env.CODEGOAT_API_KEY;
    process.env.CODEGOAT_API_KEY = "test-key";
    try {
      const provider = new AnthropicProvider();
      assert.equal(provider.name, "anthropic");
    } finally {
      if (saved) process.env.CODEGOAT_API_KEY = saved;
      else delete process.env.CODEGOAT_API_KEY;
    }
  });

  it("parses Anthropic SSE stream correctly", async () => {
    const saved = process.env.CODEGOAT_API_KEY;
    process.env.CODEGOAT_API_KEY = "test-key";
    try {
      const provider = new AnthropicProvider();

      // Mock SSE data in Anthropic format
      const sseData = [
        'data: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","content":[]}}',
        'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world"}}',
        'data: {"type":"content_block_stop","index":0}',
        'data: {"type":"message_stop"}',
        "",
      ].join("\n");

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(sseData));
          controller.close();
        },
      });

      // Access private method via prototype
      const chunks: string[] = [];
      for await (const chunk of (provider as any).parseSSEStream(stream)) {
        chunks.push(chunk);
      }

      assert.deepEqual(chunks, ["Hello", " world"]);
    } finally {
      if (saved) process.env.CODEGOAT_API_KEY = saved;
      else delete process.env.CODEGOAT_API_KEY;
    }
  });

  it("throws on non-200 response", async () => {
    const saved = process.env.CODEGOAT_API_KEY;
    process.env.CODEGOAT_API_KEY = "test-key";
    const originalFetch = globalThis.fetch;
    try {
      const provider = new AnthropicProvider();
      globalThis.fetch = async () =>
        new Response("Unauthorized", { status: 401 });

      const iter = provider.chat({
        messages: [{ role: "user", content: "test" }],
      });
      await assert.rejects(async () => {
        for await (const _ of iter) { /* consume */ }
      }, /Anthropic API error \(401\)/);
    } finally {
      globalThis.fetch = originalFetch;
      if (saved) process.env.CODEGOAT_API_KEY = saved;
      else delete process.env.CODEGOAT_API_KEY;
    }
  });

  it("throws on network failure", async () => {
    const saved = process.env.CODEGOAT_API_KEY;
    process.env.CODEGOAT_API_KEY = "test-key";
    const originalFetch = globalThis.fetch;
    try {
      const provider = new AnthropicProvider();
      globalThis.fetch = async () => {
        throw new Error("Connection refused");
      };

      const iter = provider.chat({
        messages: [{ role: "user", content: "test" }],
      });
      await assert.rejects(async () => {
        for await (const _ of iter) { /* consume */ }
      }, /Network error connecting to Anthropic/);
    } finally {
      globalThis.fetch = originalFetch;
      if (saved) process.env.CODEGOAT_API_KEY = saved;
      else delete process.env.CODEGOAT_API_KEY;
    }
  });
});
