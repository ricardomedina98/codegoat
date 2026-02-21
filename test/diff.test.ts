import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDiffReviewPrompt } from "../src/providers/prompts.js";

describe("buildDiffReviewPrompt", () => {
  const files = [
    { path: "src/auth.ts", content: "1 | [changed] const x = 1;", linesAdded: 1, linesRemoved: 0 },
    { path: "src/api.ts", content: "1 | [context] import y\n2 | [changed] export const z = 2;", linesAdded: 1, linesRemoved: 1 },
  ];

  it("produces system + user messages", () => {
    const msgs = buildDiffReviewPrompt(files, 2, 1);
    assert.equal(msgs.length, 2);
    assert.equal(msgs[0].role, "system");
    assert.equal(msgs[1].role, "user");
  });

  it("system prompt focuses on changes", () => {
    const msgs = buildDiffReviewPrompt(files, 2, 1);
    assert.ok(msgs[0].content.includes("changeset"));
    assert.ok(msgs[0].content.includes("[changed]"));
  });

  it("includes diff stats in user message", () => {
    const msgs = buildDiffReviewPrompt(files, 2, 1);
    assert.ok(msgs[1].content.includes("2 files"));
    assert.ok(msgs[1].content.includes("+2 -1"));
  });

  it("includes file content with add/remove counts", () => {
    const msgs = buildDiffReviewPrompt(files, 2, 1);
    assert.ok(msgs[1].content.includes("=== src/auth.ts (+1 -0) ==="));
    assert.ok(msgs[1].content.includes("=== src/api.ts (+1 -1) ==="));
  });

  it("asks for changeset summary", () => {
    const msgs = buildDiffReviewPrompt(files, 2, 1);
    assert.ok(msgs[1].content.includes("summary"));
  });
});
