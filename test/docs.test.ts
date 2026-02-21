import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocsPrompt } from "../src/providers/prompts.js";

const SAMPLE_FILES = [
  { path: "src/index.ts", content: 'export function hello() { return "hi"; }' },
  { path: "src/utils.ts", content: "export const add = (a: number, b: number) => a + b;" },
];

describe("buildDocsPrompt", () => {
  it("produces system + user messages", () => {
    const msgs = buildDocsPrompt(SAMPLE_FILES, "project");
    assert.equal(msgs.length, 2);
    assert.equal(msgs[0].role, "system");
    assert.equal(msgs[1].role, "user");
  });

  it("includes file contents in user message", () => {
    const msgs = buildDocsPrompt(SAMPLE_FILES, "project");
    assert.ok(msgs[1].content.includes("=== src/index.ts ==="));
    assert.ok(msgs[1].content.includes("=== src/utils.ts ==="));
    assert.ok(msgs[1].content.includes("hello()"));
  });

  it("uses project-level instructions for project level", () => {
    const msgs = buildDocsPrompt(SAMPLE_FILES, "project");
    assert.ok(msgs[0].content.includes("README-style"));
    assert.ok(msgs[1].content.includes("Architecture"));
  });

  it("uses file-level instructions for file level", () => {
    const msgs = buildDocsPrompt(SAMPLE_FILES, "file");
    assert.ok(msgs[0].content.includes("per-file"));
    assert.ok(msgs[1].content.includes("Exports"));
  });

  it("uses function-level instructions for function level", () => {
    const msgs = buildDocsPrompt(SAMPLE_FILES, "function");
    assert.ok(msgs[0].content.includes("function-level"));
    assert.ok(msgs[1].content.includes("JSDoc"));
  });

  it("does not add line numbers (unlike review)", () => {
    const msgs = buildDocsPrompt(SAMPLE_FILES, "project");
    assert.ok(!msgs[1].content.includes("1 |"), "docs prompt should not have line numbers");
  });
});
