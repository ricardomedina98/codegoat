import {
  createConnection,
  TextDocuments,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  CodeActionKind,
  type Diagnostic,
  type CodeAction,
  type CodeActionParams,
  type InitializeResult,
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { createProvider } from "../providers/factory.js";
import { buildReviewPrompt } from "../providers/prompts.js";
import { parseFindings, filterBySeverity, severityFromString, type Finding, type Severity } from "../output/severity.js";
import type { ChatMessage } from "../providers/types.js";

// ── Types ──────────────────────────────────────────────────────────────

export interface LSPSettings {
  provider: string;
  model?: string;
  severity: string;
  reviewOnSave: boolean;
  rules: string[];
}

const DEFAULT_SETTINGS: LSPSettings = {
  provider: "openai",
  severity: "info",
  reviewOnSave: true,
  rules: [],
};

// ── Severity mapping ───────────────────────────────────────────────────

const SEVERITY_MAP: Record<Severity, DiagnosticSeverity> = {
  critical: DiagnosticSeverity.Error,
  warning: DiagnosticSeverity.Warning,
  info: DiagnosticSeverity.Information,
  style: DiagnosticSeverity.Hint,
};

export function mapSeverity(severity: Severity): DiagnosticSeverity {
  return SEVERITY_MAP[severity] ?? DiagnosticSeverity.Information;
}

// ── Finding → Diagnostic ───────────────────────────────────────────────

export function findingToDiagnostic(finding: Finding): Diagnostic {
  const line = Math.max(0, (finding.line ?? 1) - 1);
  return {
    severity: mapSeverity(finding.severity),
    range: {
      start: { line, character: 0 },
      end: { line, character: Number.MAX_SAFE_INTEGER },
    },
    message: finding.message,
    source: "codegoat",
    code: finding.severity,
  };
}

// ── LSP Server ─────────────────────────────────────────────────────────

export function startServer(): void {
  const connection = createConnection(ProposedFeatures.all);
  const documents = new TextDocuments(TextDocument);
  let settings: LSPSettings = { ...DEFAULT_SETTINGS };

  // Track diagnostics per URI for code actions
  const diagnosticFindings = new Map<string, Finding[]>();

  connection.onInitialize((params: InitializeParams): InitializeResult => {
    const initOpts = params.initializationOptions ?? {};
    settings = {
      provider: initOpts.provider ?? DEFAULT_SETTINGS.provider,
      model: initOpts.model ?? DEFAULT_SETTINGS.model,
      severity: initOpts.severity ?? DEFAULT_SETTINGS.severity,
      reviewOnSave: initOpts.reviewOnSave ?? DEFAULT_SETTINGS.reviewOnSave,
      rules: initOpts.rules ?? DEFAULT_SETTINGS.rules,
    };

    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        codeActionProvider: {
          codeActionKinds: [CodeActionKind.QuickFix],
        },
      },
    };
  });

  // Review on save
  documents.onDidSave(async (change) => {
    if (!settings.reviewOnSave) return;
    await reviewDocument(change.document);
  });

  // Also review on open
  documents.onDidOpen(async (change) => {
    if (!settings.reviewOnSave) return;
    await reviewDocument(change.document);
  });

  async function reviewDocument(document: TextDocument): Promise<void> {
    const uri = document.uri;
    const text = document.getText();
    const filePath = uri.replace(/^file:\/\//, "");
    const fileName = filePath.split("/").pop() ?? "file";

    try {
      const provider = createProvider(settings.provider, settings.model);
      const messages = buildReviewPrompt(
        [{ path: fileName, content: text }],
        settings.rules.length > 0 ? settings.rules : undefined,
      );

      let raw = "";
      for await (const chunk of provider.chat(messages as ChatMessage[])) {
        raw += chunk;
      }

      const parsed = parseFindings(raw);
      const threshold = severityFromString(settings.severity);
      const filtered = filterBySeverity(parsed.findings, threshold);

      // Fix up file references — all findings should reference this file
      for (const f of filtered) f.file = fileName;

      diagnosticFindings.set(uri, filtered);

      const diagnostics: Diagnostic[] = filtered.map(findingToDiagnostic);
      connection.sendDiagnostics({ uri, diagnostics });
    } catch (err) {
      connection.console.error(`codegoat review failed: ${err instanceof Error ? err.message : String(err)}`);
      // Clear diagnostics on error
      connection.sendDiagnostics({ uri, diagnostics: [] });
    }
  }

  // Code actions (Quick Fix)
  connection.onCodeAction((params: CodeActionParams): CodeAction[] => {
    const uri = params.textDocument.uri;
    const findings = diagnosticFindings.get(uri);
    if (!findings) return [];

    const actions: CodeAction[] = [];
    for (const diag of params.context.diagnostics) {
      if (diag.source !== "codegoat") continue;

      const finding = findings.find(f =>
        (f.line ?? 1) - 1 === diag.range.start.line &&
        f.severity === diag.code
      );
      if (!finding) continue;

      actions.push({
        title: `Fix: ${finding.message.slice(0, 60)}${finding.message.length > 60 ? "…" : ""}`,
        kind: CodeActionKind.QuickFix,
        diagnostics: [diag],
        command: {
          title: "Run codegoat fix",
          command: "codegoat.fix",
          arguments: [uri, finding.line ?? 1, finding.message],
        },
      });
    }

    return actions;
  });

  // Configuration change
  connection.onDidChangeConfiguration((change) => {
    const s = change.settings?.codegoat ?? {};
    if (s.provider) settings.provider = s.provider;
    if (s.model) settings.model = s.model;
    if (s.severity) settings.severity = s.severity;
    if (s.reviewOnSave !== undefined) settings.reviewOnSave = s.reviewOnSave;
    if (s.rules) settings.rules = s.rules;
  });

  documents.listen(connection);
  connection.listen();
}
