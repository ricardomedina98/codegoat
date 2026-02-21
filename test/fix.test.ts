import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractContext, parseFixOutput, generateDiffPreview } from "../src/commands/fix.js";

describe("extractContext", () => {
  const content = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`).join("\n");

  it("extracts lines around target with default context", () => {
    const { lines, startLine, endLine } = extractContext(content, 25);
    assert.equal(startLine, 10); // 25 - 15 = 10
    assert.equal(endLine, 40); // 25 + 15 = 40
    assert.equal(lines.length, 31); // 15 above + target + 15 below
    assert.equal(lines[0], "line 10");
  });

  it("clamps to start of file", () => {
    const { lines, startLine } = extractContext(content, 3);
    assert.equal(startLine, 1);
    assert.ok(lines[0].includes("line 1"));
  });

  it("clamps to end of file", () => {
    const { lines, endLine } = extractContext(content, 48);
    assert.equal(endLine, 50);
    assert.ok(lines[lines.length - 1].includes("line 50"));
  });

  it("works with custom context size", () => {
    const { lines } = extractContext(content, 25, 5);
    assert.equal(lines.length, 11); // 5 above + target + 5 below
  });
});

describe("parseFixOutput", () => {
  it("parses numbered lines", () => {
    const raw = "42: const x = sanitize(input);\n43: const y = validate(x);";
    const result = parseFixOutput(raw, 40, 50);
    assert.ok(result);
    assert.equal(result[0], "const x = sanitize(input);");
    assert.equal(result[1], "const y = validate(x);");
  });

  it("parses plain lines without numbers", () => {
    const raw = "const x = sanitize(input);\nconst y = validate(x);";
    const result = parseFixOutput(raw, 40, 50);
    assert.ok(result);
    assert.equal(result.length, 2);
  });

  it("extracts from code fences", () => {
    const raw = "```typescript\nconst x = 1;\n```";
    const result = parseFixOutput(raw, 1, 5);
    assert.ok(result);
    assert.equal(result[0], "const x = 1;");
  });

  it("returns null for empty output", () => {
    const result = parseFixOutput("", 1, 5);
    assert.equal(result, null);
  });
});

describe("generateDiffPreview", () => {
  it("generates a diff with + and - lines", () => {
    const fix = {
      file: "src/app.ts",
      line: 10,
      originalLines: ["const password = input;", "db.query(password);"],
      fixedLines: ["const password = sanitize(input);", "db.query(password);"],
      finding: { file: "src/app.ts", line: 10, severity: "critical" as const, message: "Unsanitized input" },
    };
    const preview = generateDiffPreview(fix);
    assert.ok(preview.includes("src/app.ts"));
    assert.ok(preview.includes("critical"));
    assert.ok(preview.includes("-const password = input;"));
    assert.ok(preview.includes("+const password = sanitize(input);"));
  });

  it("shows unchanged lines with space prefix", () => {
    const fix = {
      file: "a.ts",
      line: 1,
      originalLines: ["same line", "changed"],
      fixedLines: ["same line", "fixed"],
      finding: { file: "a.ts", line: 1, severity: "warning" as const, message: "issue" },
    };
    const preview = generateDiffPreview(fix);
    assert.ok(preview.includes(" same line"));
  });
});
