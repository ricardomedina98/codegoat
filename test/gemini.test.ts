import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { GeminiProvider } from "../src/providers/gemini.js";

describe("GeminiProvider", () => {
  const origKey = process.env.GOOGLE_API_KEY;
  const origCgKey = process.env.CODEGOAT_API_KEY;

  beforeEach(() => {
    process.env.GOOGLE_API_KEY = "test-gemini-key";
  });

  afterEach(() => {
    if (origKey !== undefined) process.env.GOOGLE_API_KEY = origKey;
    else delete process.env.GOOGLE_API_KEY;
    if (origCgKey !== undefined) process.env.CODEGOAT_API_KEY = origCgKey;
    else delete process.env.CODEGOAT_API_KEY;
  });

  it("throws when no API key is set", () => {
    delete process.env.GOOGLE_API_KEY;
    delete process.env.CODEGOAT_API_KEY;
    assert.throws(() => new GeminiProvider(), /GOOGLE_API_KEY/);
  });

  it("accepts GOOGLE_API_KEY", () => {
    process.env.GOOGLE_API_KEY = "gkey";
    const p = new GeminiProvider();
    assert.equal(p.name, "gemini");
  });

  it("falls back to CODEGOAT_API_KEY", () => {
    delete process.env.GOOGLE_API_KEY;
    process.env.CODEGOAT_API_KEY = "cgkey";
    const p = new GeminiProvider();
    assert.equal(p.name, "gemini");
  });

  it("has name 'gemini'", () => {
    const p = new GeminiProvider();
    assert.equal(p.name, "gemini");
  });
});

describe("Gemini factory integration", () => {
  const origKey = process.env.GOOGLE_API_KEY;

  afterEach(() => {
    if (origKey !== undefined) process.env.GOOGLE_API_KEY = origKey;
    else delete process.env.GOOGLE_API_KEY;
  });

  it("createProvider('gemini') returns GeminiProvider", async () => {
    process.env.GOOGLE_API_KEY = "test-key";
    const { createProvider } = await import("../src/providers/factory.js");
    const p = createProvider("gemini");
    assert.equal(p.name, "gemini");
  });
});
