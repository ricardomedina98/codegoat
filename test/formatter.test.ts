import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatMarkdown, formatJson } from "../src/output/formatter.js";
import { createColors, shouldColor } from "../src/output/color.js";

const SAMPLE_RESULT = {
  raw: "### src/cli.ts\n\n- **Bug (line 5):** Missing null check\n\n1 issues found: 1 bug",
  filesScanned: 12,
  filesSkipped: 3,
  estimatedTokens: 8432,
};

describe("formatMarkdown", () => {
  it("includes header with stats", () => {
    const out = formatMarkdown(SAMPLE_RESULT, false);
    assert.ok(out.includes("## codegoat review"));
    assert.ok(out.includes("Files scanned: 12 of 15"));
    assert.ok(out.includes("3 skipped"));
    assert.ok(out.includes("8,432"));
  });

  it("includes raw review body", () => {
    const out = formatMarkdown(SAMPLE_RESULT, false);
    assert.ok(out.includes("Missing null check"));
  });

  it("works with zero skipped files", () => {
    const result = { ...SAMPLE_RESULT, filesSkipped: 0 };
    const out = formatMarkdown(result, false);
    assert.ok(out.includes("Files scanned: 12 of 12"));
    assert.ok(!out.includes("skipped"));
  });
});

describe("formatJson", () => {
  it("produces valid JSON", () => {
    const out = formatJson(SAMPLE_RESULT);
    const parsed = JSON.parse(out);
    assert.equal(parsed.version, "0.1.0");
    assert.equal(parsed.filesScanned, 12);
    assert.equal(parsed.filesSkipped, 3);
    assert.equal(parsed.estimatedTokens, 8432);
    assert.ok(parsed.review.includes("Missing null check"));
  });
});

describe("createColors", () => {
  it("returns identity functions when disabled", () => {
    const c = createColors(false);
    assert.equal(c.bold("test"), "test");
    assert.equal(c.red("test"), "test");
    assert.equal(c.dim("test"), "test");
  });

  it("wraps with ANSI codes when enabled", () => {
    const c = createColors(true);
    assert.ok(c.bold("test").includes("\x1b[1m"));
    assert.ok(c.red("test").includes("\x1b[31m"));
    assert.ok(c.bold("test").includes("\x1b[0m"));
  });
});

describe("shouldColor", () => {
  it("returns false when noColor flag is true", () => {
    assert.equal(shouldColor(true), false);
  });
});
