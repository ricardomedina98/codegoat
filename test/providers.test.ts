import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { buildReviewPrompt } from "../src/providers/prompts.js";
import { OpenAIProvider } from "../src/providers/openai.js";

describe("buildReviewPrompt", () => {
  it("returns system and user messages", () => {
    const files = [{ path: "foo.ts", content: "const x = 1;" }];
    const messages = buildReviewPrompt(files);

    assert.equal(messages.length, 2);
    assert.equal(messages[0].role, "system");
    assert.equal(messages[1].role, "user");
  });

  it("system message contains reviewer instructions", () => {
    const messages = buildReviewPrompt([{ path: "a.ts", content: "x" }]);
    assert.ok(messages[0].content.includes("senior code reviewer"));
    assert.ok(messages[0].content.includes("Bug"));
    assert.ok(messages[0].content.includes("Security"));
    assert.ok(messages[0].content.includes("Performance"));
    assert.ok(messages[0].content.includes("Style"));
    assert.ok(messages[0].content.includes("Clarity"));
  });

  it("user message contains file path header", () => {
    const messages = buildReviewPrompt([
      { path: "src/utils.ts", content: "export function add(a: number, b: number) {\n  return a + b;\n}" },
    ]);
    assert.ok(messages[1].content.includes("=== src/utils.ts ==="));
  });

  it("prepends line numbers to content", () => {
    const messages = buildReviewPrompt([
      { path: "test.ts", content: "line one\nline two\nline three" },
    ]);
    const user = messages[1].content;
    assert.ok(user.includes("1 | line one"));
    assert.ok(user.includes("2 | line two"));
    assert.ok(user.includes("3 | line three"));
  });

  it("includes multiple files", () => {
    const messages = buildReviewPrompt([
      { path: "a.ts", content: "a" },
      { path: "b.ts", content: "b" },
    ]);
    const user = messages[1].content;
    assert.ok(user.includes("=== a.ts ==="));
    assert.ok(user.includes("=== b.ts ==="));
  });

  it("user message ends with review instructions", () => {
    const messages = buildReviewPrompt([{ path: "x.ts", content: "x" }]);
    assert.ok(messages[1].content.includes("Review the code above"));
    assert.ok(messages[1].content.includes("issues found"));
  });
});

describe("createProvider", () => {
  let originalKey: string | undefined;
  let originalProvider: string | undefined;

  before(() => {
    originalKey = process.env.CODEGOAT_API_KEY;
    originalProvider = process.env.CODEGOAT_PROVIDER;
  });

  after(() => {
    if (originalKey !== undefined) {
      process.env.CODEGOAT_API_KEY = originalKey;
    } else {
      delete process.env.CODEGOAT_API_KEY;
    }
    if (originalProvider !== undefined) {
      process.env.CODEGOAT_PROVIDER = originalProvider;
    } else {
      delete process.env.CODEGOAT_PROVIDER;
    }
  });

  it("throws on unknown provider", async () => {
    process.env.CODEGOAT_API_KEY = "test-key";
    // Dynamic import to get fresh module state
    const { createProvider } = await import("../src/providers/factory.js");
    assert.throws(
      () => createProvider("unknown-provider"),
      (err: Error) => {
        assert.ok(err.message.includes("Unknown provider"));
        assert.ok(err.message.includes("unknown-provider"));
        return true;
      }
    );
  });

  it("exits when API key is missing", async () => {
    delete process.env.CODEGOAT_API_KEY;
    const exitMock = mock.fn((_code?: number): never => {
      throw new Error("process.exit called");
    });
    const originalExit = process.exit;
    process.exit = exitMock as unknown as typeof process.exit;

    try {
      const { createProvider } = await import("../src/providers/factory.js");
      assert.throws(() => createProvider("openai"), {
        message: "process.exit called",
      });
      assert.equal(exitMock.mock.calls.length, 1);
      assert.equal(exitMock.mock.calls[0].arguments[0], 1);
    } finally {
      process.exit = originalExit;
    }
  });
});

describe("OpenAIProvider", () => {
  let originalKey: string | undefined;

  before(() => {
    originalKey = process.env.CODEGOAT_API_KEY;
  });

  after(() => {
    if (originalKey !== undefined) {
      process.env.CODEGOAT_API_KEY = originalKey;
    } else {
      delete process.env.CODEGOAT_API_KEY;
    }
  });

  it("throws when API key is not set", () => {
    delete process.env.CODEGOAT_API_KEY;
    assert.throws(() => new OpenAIProvider(), (err: Error) => {
      assert.ok(err.message.includes("CODEGOAT_API_KEY"));
      return true;
    });
  });

  it("has name 'openai'", () => {
    process.env.CODEGOAT_API_KEY = "test-key";
    const provider = new OpenAIProvider();
    assert.equal(provider.name, "openai");
  });

  it("parses SSE stream correctly", async () => {
    process.env.CODEGOAT_API_KEY = "test-key";
    const provider = new OpenAIProvider();

    const sseData = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: {"choices":[{"delta":{}}]}\n\n',
      "data: [DONE]\n\n",
    ].join("");

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(sseData));
        controller.close();
      },
    });

    // Mock fetch to return our fake SSE stream
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock.fn(async () => {
      return new Response(stream, { status: 200 });
    }) as typeof fetch;

    try {
      const chunks: string[] = [];
      for await (const chunk of provider.chat({ messages: [] })) {
        chunks.push(chunk);
      }
      assert.deepEqual(chunks, ["Hello", " world"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handles chunked SSE data split across boundaries", async () => {
    process.env.CODEGOAT_API_KEY = "test-key";
    const provider = new OpenAIProvider();

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Split data across chunk boundaries
        controller.enqueue(encoder.encode('data: {"choices":[{"del'));
        controller.enqueue(encoder.encode('ta":{"content":"partial"}}]}\n\n'));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock.fn(async () => {
      return new Response(stream, { status: 200 });
    }) as typeof fetch;

    try {
      const chunks: string[] = [];
      for await (const chunk of provider.chat({ messages: [] })) {
        chunks.push(chunk);
      }
      assert.deepEqual(chunks, ["partial"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws on non-200 response", async () => {
    process.env.CODEGOAT_API_KEY = "test-key";
    const provider = new OpenAIProvider();

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock.fn(async () => {
      return new Response("Unauthorized", { status: 401 });
    }) as typeof fetch;

    try {
      const iter = provider.chat({ messages: [] });
      await assert.rejects(
        async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          for await (const _ of iter) {
            /* consume */
          }
        },
        (err: Error) => {
          assert.ok(err.message.includes("401"));
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws on network failure", async () => {
    process.env.CODEGOAT_API_KEY = "test-key";
    const provider = new OpenAIProvider();

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock.fn(async () => {
      throw new Error("fetch failed");
    }) as typeof fetch;

    try {
      const iter = provider.chat({ messages: [] });
      await assert.rejects(
        async () => {
          for await (const _ of iter) {
            /* consume */
          }
        },
        (err: Error) => {
          assert.ok(err.message.includes("Network error"));
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
