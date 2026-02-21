import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findingsToSarif, severityToSarifLevel } from "../src/output/sarif.js";
import type { Finding } from "../src/output/severity.js";

describe("severityToSarifLevel", () => {
  it("maps critical to error", () => {
    assert.equal(severityToSarifLevel("critical"), "error");
  });

  it("maps warning to warning", () => {
    assert.equal(severityToSarifLevel("warning"), "warning");
  });

  it("maps info to note", () => {
    assert.equal(severityToSarifLevel("info"), "note");
  });

  it("maps style to note", () => {
    assert.equal(severityToSarifLevel("style"), "note");
  });
});

describe("findingsToSarif", () => {
  it("generates valid SARIF 2.1.0 structure", () => {
    const findings: Finding[] = [
      { file: "src/auth.ts", line: 42, severity: "critical", message: "Timing-unsafe comparison" },
      { file: "src/utils.ts", line: 10, severity: "warning", message: "Missing null check" },
    ];

    const sarif = findingsToSarif(findings, "1.4.0");

    assert.equal(sarif.version, "2.1.0");
    assert.ok(sarif.$schema.includes("sarif-schema-2.1.0"));
    assert.equal(sarif.runs.length, 1);

    const run = sarif.runs[0];
    assert.equal(run.tool.driver.name, "codegoat");
    assert.equal(run.tool.driver.version, "1.4.0");
    assert.equal(run.tool.driver.rules.length, 4);
    assert.equal(run.results.length, 2);
  });

  it("maps findings to results correctly", () => {
    const findings: Finding[] = [
      { file: "app.py", line: 5, severity: "critical", message: "SQL injection" },
    ];

    const sarif = findingsToSarif(findings, "1.0.0");
    const result = sarif.runs[0].results[0];

    assert.equal(result.ruleId, "codegoat/critical");
    assert.equal(result.level, "error");
    assert.equal(result.message.text, "SQL injection");
    assert.equal(result.locations.length, 1);
    assert.equal(result.locations[0].physicalLocation.artifactLocation.uri, "app.py");
    assert.equal(result.locations[0].physicalLocation.region.startLine, 5);
    assert.equal(result.locations[0].physicalLocation.region.startColumn, 1);
  });

  it("handles findings without line numbers", () => {
    const findings: Finding[] = [
      { file: "main.go", severity: "info", message: "Consider error wrapping" },
    ];

    const sarif = findingsToSarif(findings, "1.0.0");
    const result = sarif.runs[0].results[0];
    assert.equal(result.locations[0].physicalLocation.region.startLine, 1);
  });

  it("generates empty results for no findings", () => {
    const sarif = findingsToSarif([], "1.0.0");
    assert.equal(sarif.runs[0].results.length, 0);
    assert.equal(sarif.runs[0].tool.driver.rules.length, 4); // rules always present
  });

  it("includes informationUri", () => {
    const sarif = findingsToSarif([], "1.0.0");
    assert.ok(sarif.runs[0].tool.driver.informationUri.includes("codegoat"));
  });
});
