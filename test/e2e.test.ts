import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { discoverFiles } from "../src/files/discover.js";
import { budgetFiles } from "../src/files/budget.js";
import { buildReviewPrompt } from "../src/providers/prompts.js";
import { formatMarkdown, formatJson } from "../src/output/formatter.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("end-to-end pipeline (mocked LLM)", () => {
  it("discovers, budgets, prompts, and formats for own codebase", async () => {
    const repoRoot = path.resolve(import.meta.dirname, "..");

    // 1. Discover
    const files = await discoverFiles(repoRoot);
    assert.ok(files.length > 0, "should find source files");
    assert.ok(files.some((f) => f.path === "src/cli.ts"), "should find src/cli.ts");
    assert.ok(!files.some((f) => f.path.includes("node_modules")), "should skip node_modules");
    assert.ok(!files.some((f) => f.path.includes("dist/")), "should skip dist/");

    // 2. Budget
    const { included, skipped, totalTokens } = budgetFiles(files, 100_000);
    assert.ok(included.length > 0, "should include files");
    assert.ok(totalTokens > 0, "should have nonzero tokens");
    assert.equal(included.length + skipped.length, files.length, "included + skipped = total");

    // 3. Prompt
    const messages = buildReviewPrompt(included);
    assert.equal(messages.length, 2, "should have system + user message");
    assert.equal(messages[0].role, "system");
    assert.equal(messages[1].role, "user");
    assert.ok(messages[1].content.includes("src/cli.ts"), "prompt should contain filenames");
    assert.ok(messages[1].content.includes("1 |"), "prompt should have line numbers");

    // 4. Format (with mock LLM output)
    const mockReview = "### src/cli.ts\n\n- **Bug (line 5):** Example issue\n\n1 issues found: 1 bug";
    const result = {
      raw: mockReview,
      filesScanned: included.length,
      filesSkipped: skipped.length,
      estimatedTokens: totalTokens,
    };

    const md = formatMarkdown(result, false);
    assert.ok(md.includes("## codegoat review"), "markdown should have header");
    assert.ok(md.includes("Example issue"), "markdown should include review body");

    const json = formatJson(result);
    const parsed = JSON.parse(json);
    assert.equal(parsed.version, "0.1.0");
    assert.equal(parsed.filesScanned, included.length);
    assert.ok(parsed.review.includes("Example issue"));
  });

  it("handles tiny budget gracefully", async () => {
    const repoRoot = path.resolve(import.meta.dirname, "..");
    const files = await discoverFiles(repoRoot);
    const { included } = budgetFiles(files, 1); // 1 token budget
    assert.equal(included.length, 0, "nothing should fit in 1 token budget");
  });

  it("handles empty directory", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codegoat-e2e-"));
    try {
      const files = await discoverFiles(tmpDir);
      assert.equal(files.length, 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("handles directory with only non-JS files", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codegoat-e2e-"));
    try {
      fs.writeFileSync(path.join(tmpDir, "readme.md"), "# Hello");
      fs.writeFileSync(path.join(tmpDir, "data.json"), "{}");
      const files = await discoverFiles(tmpDir);
      assert.equal(files.length, 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("skips files over 50KB", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codegoat-e2e-"));
    try {
      fs.writeFileSync(path.join(tmpDir, "small.ts"), "const x = 1;");
      fs.writeFileSync(path.join(tmpDir, "big.ts"), "x".repeat(51 * 1024)); // 51KB
      const files = await discoverFiles(tmpDir);
      assert.equal(files.length, 1);
      assert.equal(files[0].path, "small.ts");
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});
