import type { Finding, Severity } from "./severity.js";

// SARIF 2.1.0 types (subset)

export interface SarifLog {
  $schema: string;
  version: string;
  runs: SarifRun[];
}

export interface SarifRun {
  tool: {
    driver: {
      name: string;
      version: string;
      informationUri: string;
      rules: SarifRule[];
    };
  };
  results: SarifResult[];
}

export interface SarifRule {
  id: string;
  shortDescription: { text: string };
  defaultConfiguration: { level: SarifLevel };
}

export interface SarifResult {
  ruleId: string;
  level: SarifLevel;
  message: { text: string };
  locations: SarifLocation[];
}

export interface SarifLocation {
  physicalLocation: {
    artifactLocation: { uri: string };
    region: { startLine: number; startColumn: number };
  };
}

export type SarifLevel = "error" | "warning" | "note" | "none";

// ── Mapping ────────────────────────────────────────────────────────────

const SEVERITY_TO_LEVEL: Record<Severity, SarifLevel> = {
  critical: "error",
  warning: "warning",
  info: "note",
  style: "note",
};

export function severityToSarifLevel(severity: Severity): SarifLevel {
  return SEVERITY_TO_LEVEL[severity] ?? "note";
}

// ── Generator ──────────────────────────────────────────────────────────

const SARIF_RULES: SarifRule[] = [
  { id: "codegoat/critical", shortDescription: { text: "Critical issue — bugs, security vulnerabilities, crashes" }, defaultConfiguration: { level: "error" } },
  { id: "codegoat/warning", shortDescription: { text: "Warning — likely problems, missing error handling" }, defaultConfiguration: { level: "warning" } },
  { id: "codegoat/info", shortDescription: { text: "Information — improvement suggestions" }, defaultConfiguration: { level: "note" } },
  { id: "codegoat/style", shortDescription: { text: "Style — cosmetic, naming conventions" }, defaultConfiguration: { level: "note" } },
];

export function findingsToSarif(findings: Finding[], version: string): SarifLog {
  const results: SarifResult[] = findings.map((f) => ({
    ruleId: `codegoat/${f.severity}`,
    level: severityToSarifLevel(f.severity),
    message: { text: f.message },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: f.file },
          region: { startLine: Math.max(1, f.line ?? 1), startColumn: 1 },
        },
      },
    ],
  }));

  return {
    $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "codegoat",
            version,
            informationUri: "https://github.com/ricardomedina98/codegoat",
            rules: SARIF_RULES,
          },
        },
        results,
      },
    ],
  };
}
