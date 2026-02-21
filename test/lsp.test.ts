import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DiagnosticSeverity } from "vscode-languageserver/node.js";
import { mapSeverity, findingToDiagnostic } from "../src/lsp/server.js";
import type { Finding } from "../src/output/severity.js";

describe("mapSeverity", () => {
  it("maps critical to Error", () => {
    assert.equal(mapSeverity("critical"), DiagnosticSeverity.Error);
  });

  it("maps warning to Warning", () => {
    assert.equal(mapSeverity("warning"), DiagnosticSeverity.Warning);
  });

  it("maps info to Information", () => {
    assert.equal(mapSeverity("info"), DiagnosticSeverity.Information);
  });

  it("maps style to Hint", () => {
    assert.equal(mapSeverity("style"), DiagnosticSeverity.Hint);
  });
});

describe("findingToDiagnostic", () => {
  it("converts a finding with line number", () => {
    const finding: Finding = {
      file: "src/foo.ts",
      line: 42,
      severity: "critical",
      message: "Timing-unsafe comparison",
    };
    const diag = findingToDiagnostic(finding);
    assert.equal(diag.severity, DiagnosticSeverity.Error);
    assert.equal(diag.range.start.line, 41); // 0-indexed
    assert.equal(diag.range.start.character, 0);
    assert.equal(diag.message, "Timing-unsafe comparison");
    assert.equal(diag.source, "codegoat");
    assert.equal(diag.code, "critical");
  });

  it("defaults to line 0 when no line number", () => {
    const finding: Finding = {
      file: "src/bar.py",
      severity: "info",
      message: "Consider using a list comprehension",
    };
    const diag = findingToDiagnostic(finding);
    assert.equal(diag.range.start.line, 0);
    assert.equal(diag.severity, DiagnosticSeverity.Information);
  });

  it("maps all severity levels correctly", () => {
    const severities: Array<[string, number]> = [
      ["critical", DiagnosticSeverity.Error],
      ["warning", DiagnosticSeverity.Warning],
      ["info", DiagnosticSeverity.Information],
      ["style", DiagnosticSeverity.Hint],
    ];
    for (const [sev, expected] of severities) {
      const finding: Finding = { file: "x.ts", line: 1, severity: sev as any, message: "test" };
      assert.equal(findingToDiagnostic(finding).severity, expected, `${sev} should map to ${expected}`);
    }
  });
});
