import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildReviewPrompt, buildDiffReviewPrompt } from "../src/providers/prompts.js";
import { validateRules } from "../src/config.js";

describe("custom rules in prompts", () => {
  it("injects rules into review system prompt", () => {
    const rules = ["Always use error boundaries", "No console.log in production"];
    const msgs = buildReviewPrompt([{ path: "a.ts", content: "x" }], rules);
    assert.ok(msgs[0].content.includes("Project-specific rules"));
    assert.ok(msgs[0].content.includes("Always use error boundaries"));
    assert.ok(msgs[0].content.includes("No console.log in production"));
  });

  it("injects rules into diff review system prompt", () => {
    const rules = ["Check for SQL injection"];
    const msgs = buildDiffReviewPrompt(
      [{ path: "a.ts", content: "x", linesAdded: 1, linesRemoved: 0 }],
      1, 0, rules
    );
    assert.ok(msgs[0].content.includes("Check for SQL injection"));
  });

  it("works with no rules", () => {
    const msgs = buildReviewPrompt([{ path: "a.ts", content: "x" }]);
    assert.ok(!msgs[0].content.includes("Project-specific rules"));
  });

  it("works with empty rules array", () => {
    const msgs = buildReviewPrompt([{ path: "a.ts", content: "x" }], []);
    assert.ok(!msgs[0].content.includes("Project-specific rules"));
  });
});

describe("validateRules", () => {
  it("passes through valid rules", () => {
    const result = validateRules(["rule 1", "rule 2"]);
    assert.deepEqual(result, ["rule 1", "rule 2"]);
  });

  it("trims and limits rule length", () => {
    const long = "x".repeat(300);
    const result = validateRules([`  ${long}  `]);
    assert.equal(result[0].length, 200);
  });

  it("caps at 20 rules", () => {
    const rules = Array.from({ length: 25 }, (_, i) => `rule ${i}`);
    const result = validateRules(rules);
    assert.equal(result.length, 20);
  });

  it("filters empty rules", () => {
    const result = validateRules(["valid", "", "  ", "also valid"]);
    assert.deepEqual(result, ["valid", "also valid"]);
  });
});
