export type Severity = "critical" | "warning" | "info" | "style";

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 3,
  warning: 2,
  info: 1,
  style: 0,
};

export const SEVERITY_EMOJI: Record<Severity, string> = {
  critical: "🔴",
  warning: "🟡",
  info: "🔵",
  style: "⚪",
};

export interface Finding {
  file: string;
  line?: number;
  severity: Severity;
  message: string;
}

export interface ParsedReview {
  summary: string;
  findings: Finding[];
  raw: string;
}

const SEVERITY_PATTERN = /^\[(\w+)\]\s*(.+?)(?::(\d+))?\s*[—–-]\s*(.+)$/;
const MARKDOWN_PATTERN = /^[-*]\s+\*\*(\w+)\s*\(line\s+(\d+)\):?\*\*:?\s*(.+)$/i;
const FILE_HEADER_PATTERN = /^###\s+(.+)$/;

function parseSeverityToken(token: string): Severity | null {
  const lower = token.toLowerCase();
  if (lower === "critical" || lower === "bug" || lower === "security") return "critical";
  if (lower === "warning" || lower === "performance") return "warning";
  if (lower === "info" || lower === "clarity") return "info";
  if (lower === "style") return "style";
  return null;
}

export function parseFindings(raw: string): ParsedReview {
  const lines = raw.split("\n");
  const findings: Finding[] = [];
  let currentFile = "";
  const summaryLines: string[] = [];
  let inSummary = true;

  for (const line of lines) {
    const trimmed = line.trim();

    // File header
    const fileMatch = trimmed.match(FILE_HEADER_PATTERN);
    if (fileMatch) {
      currentFile = fileMatch[1].replace(/`/g, "").trim();
      inSummary = false;
      continue;
    }

    // [severity] file:line — message
    const bracketMatch = trimmed.match(SEVERITY_PATTERN);
    if (bracketMatch) {
      inSummary = false;
      const sev = parseSeverityToken(bracketMatch[1]);
      findings.push({
        file: bracketMatch[2].trim(),
        line: bracketMatch[3] ? parseInt(bracketMatch[3], 10) : undefined,
        severity: sev ?? "info",
        message: bracketMatch[4].trim(),
      });
      continue;
    }

    // - **Category (line N):** message (existing format)
    const mdMatch = trimmed.match(MARKDOWN_PATTERN);
    if (mdMatch) {
      inSummary = false;
      const sev = parseSeverityToken(mdMatch[1]);
      findings.push({
        file: currentFile,
        line: parseInt(mdMatch[2], 10),
        severity: sev ?? "info",
        message: mdMatch[3].trim(),
      });
      continue;
    }

    if (inSummary && trimmed && !trimmed.startsWith("#")) {
      summaryLines.push(trimmed);
    }
  }

  return {
    summary: summaryLines.join(" ").slice(0, 500),
    findings,
    raw,
  };
}

export function filterBySeverity(findings: Finding[], threshold: Severity): Finding[] {
  const minLevel = SEVERITY_ORDER[threshold];
  return findings.filter((f) => SEVERITY_ORDER[f.severity] >= minLevel);
}

export function getMaxSeverity(findings: Finding[]): Severity | null {
  if (findings.length === 0) return null;
  let max: Severity = "style";
  for (const f of findings) {
    if (SEVERITY_ORDER[f.severity] > SEVERITY_ORDER[max]) {
      max = f.severity;
    }
  }
  return max;
}

export function countBySeverity(findings: Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, warning: 0, info: 0, style: 0 };
  for (const f of findings) {
    counts[f.severity]++;
  }
  return counts;
}

export function severityFromString(s: string): Severity {
  const lower = s.toLowerCase();
  if (lower in SEVERITY_ORDER) return lower as Severity;
  return "info"; // default
}
