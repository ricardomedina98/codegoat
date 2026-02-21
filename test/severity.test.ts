import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseFindings, filterBySeverity, getMaxSeverity, countBySeverity, severityFromString,
} from "../src/output/severity.js";

const SAMPLE_RAW = `
This code has several issues.

### src/auth.ts

- **critical (line 42):** Password comparison vulnerable to timing attack
- **warning (line 89):** No error handling for network timeout

### src/utils.ts

- **info (line 15):** Consider extracting validation logic
- **style (line 3):** Inconsistent import ordering

4 issues found: 1 critical, 1 warning, 1 info, 1 style
`;

describe("parseFindings", () => {
  it("extracts findings with severity from markdown format", () => {
    const result = parseFindings(SAMPLE_RAW);
    assert.equal(result.findings.length, 4);
    assert.equal(result.findings[0].severity, "critical");
    assert.equal(result.findings[0].file, "src/auth.ts");
    assert.equal(result.findings[0].line, 42);
    assert.equal(result.findings[1].severity, "warning");
    assert.equal(result.findings[2].severity, "info");
    assert.equal(result.findings[3].severity, "style");
  });

  it("maps Bug/Security to critical", () => {
    const raw = "### src/a.ts\n\n- **Bug (line 1):** crash\n- **Security (line 2):** vuln\n";
    const result = parseFindings(raw);
    assert.equal(result.findings.length, 2);
    assert.equal(result.findings[0].severity, "critical");
    assert.equal(result.findings[1].severity, "critical");
  });

  it("maps Performance to warning", () => {
    const raw = "### src/a.ts\n\n- **Performance (line 1):** slow\n";
    const result = parseFindings(raw);
    assert.equal(result.findings[0].severity, "warning");
  });

  it("returns empty for clean review", () => {
    const result = parseFindings("The code looks good. No issues found.");
    assert.equal(result.findings.length, 0);
  });
});

describe("filterBySeverity", () => {
  const findings = parseFindings(SAMPLE_RAW).findings;

  it("filters to critical only", () => {
    const filtered = filterBySeverity(findings, "critical");
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].severity, "critical");
  });

  it("filters to warning+ (critical + warning)", () => {
    const filtered = filterBySeverity(findings, "warning");
    assert.equal(filtered.length, 2);
  });

  it("filters to info+ (critical + warning + info)", () => {
    const filtered = filterBySeverity(findings, "info");
    assert.equal(filtered.length, 3);
  });

  it("style shows everything", () => {
    const filtered = filterBySeverity(findings, "style");
    assert.equal(filtered.length, 4);
  });
});

describe("getMaxSeverity", () => {
  it("returns critical when present", () => {
    const findings = parseFindings(SAMPLE_RAW).findings;
    assert.equal(getMaxSeverity(findings), "critical");
  });

  it("returns null for empty findings", () => {
    assert.equal(getMaxSeverity([]), null);
  });
});

describe("countBySeverity", () => {
  it("counts correctly", () => {
    const findings = parseFindings(SAMPLE_RAW).findings;
    const counts = countBySeverity(findings);
    assert.deepEqual(counts, { critical: 1, warning: 1, info: 1, style: 1 });
  });
});

describe("severityFromString", () => {
  it("parses valid levels", () => {
    assert.equal(severityFromString("critical"), "critical");
    assert.equal(severityFromString("WARNING"), "warning");
    assert.equal(severityFromString("Info"), "info");
    assert.equal(severityFromString("style"), "style");
  });

  it("defaults to info for unknown", () => {
    assert.equal(severityFromString("banana"), "info");
  });
});
