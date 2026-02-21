import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseDiffLines, mapFindings, type InlineComment } from "../src/github/pr-review.js";
import type { Finding } from "../src/output/severity.js";

describe("parseDiffLines", () => {
  it("extracts right-side line numbers from unified diff", () => {
    const files = [{
      filename: "src/app.ts",
      patch: `@@ -10,6 +10,8 @@ import { foo } from "bar";
 const x = 1;
 const y = 2;
+const z = 3;
+const w = 4;
 const a = 5;
 const b = 6;`,
    }];
    const result = parseDiffLines(files);
    const lines = result.get("src/app.ts")!;
    assert.ok(lines.has(10)); // context line
    assert.ok(lines.has(11)); // context line
    assert.ok(lines.has(12)); // added
    assert.ok(lines.has(13)); // added
    assert.ok(lines.has(14)); // context
    assert.ok(lines.has(15)); // context
  });

  it("handles deleted lines (no right-side number)", () => {
    const files = [{
      filename: "src/app.ts",
      patch: `@@ -5,4 +5,3 @@
 keep
-removed
 keep2
 keep3`,
    }];
    const result = parseDiffLines(files);
    const lines = result.get("src/app.ts")!;
    assert.ok(lines.has(5));
    assert.ok(lines.has(6)); // keep2
    assert.ok(lines.has(7)); // keep3
    assert.equal(lines.size, 3);
  });

  it("handles multiple hunks", () => {
    const files = [{
      filename: "a.ts",
      patch: `@@ -1,3 +1,4 @@
 line1
+added1
 line2
 line3
@@ -10,3 +11,4 @@
 line10
+added2
 line11
 line12`,
    }];
    const result = parseDiffLines(files);
    const lines = result.get("a.ts")!;
    assert.ok(lines.has(2)); // added1
    assert.ok(lines.has(12)); // added2
  });

  it("returns empty map for files without patch", () => {
    const result = parseDiffLines([{ filename: "binary.png" }]);
    assert.equal(result.size, 0);
  });
});

describe("mapFindings", () => {
  const diffLines = new Map([
    ["src/auth.ts", new Set([10, 11, 12, 13, 14, 15])],
    ["src/utils.ts", new Set([5, 6, 7])],
  ]);

  it("maps findings to inline comments when line is in diff", () => {
    const findings: Finding[] = [
      { file: "src/auth.ts", line: 12, severity: "critical", message: "SQL injection" },
    ];
    const { inline, summary } = mapFindings(findings, diffLines, "warning");
    assert.equal(inline.length, 1);
    assert.equal(inline[0].path, "src/auth.ts");
    assert.equal(inline[0].line, 12);
    assert.ok(inline[0].body.includes("critical"));
    assert.equal(summary.length, 0);
  });

  it("finds closest diff line when exact line not in diff", () => {
    const findings: Finding[] = [
      { file: "src/auth.ts", line: 8, severity: "warning", message: "missing check" },
    ];
    const { inline, summary } = mapFindings(findings, diffLines, "warning");
    assert.equal(inline.length, 1);
    assert.equal(inline[0].line, 10); // closest
    assert.ok(inline[0].body.includes("related to line 8"));
  });

  it("puts findings in summary when file not in diff", () => {
    const findings: Finding[] = [
      { file: "src/other.ts", line: 5, severity: "critical", message: "bug" },
    ];
    const { inline, summary } = mapFindings(findings, diffLines, "warning");
    assert.equal(inline.length, 0);
    assert.equal(summary.length, 1);
  });

  it("puts below-threshold findings in summary", () => {
    const findings: Finding[] = [
      { file: "src/auth.ts", line: 12, severity: "info", message: "consider refactor" },
    ];
    const { inline, summary } = mapFindings(findings, diffLines, "warning");
    assert.equal(inline.length, 0);
    assert.equal(summary.length, 1);
  });

  it("caps inline comments at 30", () => {
    const findings: Finding[] = Array.from({ length: 35 }, (_, i) => ({
      file: "src/auth.ts", line: 10 + (i % 6), severity: "warning" as const, message: `finding ${i}`,
    }));
    const { inline, summary } = mapFindings(findings, diffLines, "warning");
    assert.equal(inline.length, 30);
    assert.equal(summary.length, 5);
  });

  it("handles findings without line number", () => {
    const findings: Finding[] = [
      { file: "src/auth.ts", severity: "warning", message: "general issue" },
    ];
    const { inline, summary } = mapFindings(findings, diffLines, "warning");
    assert.equal(inline.length, 0);
    assert.equal(summary.length, 1);
  });
});
