import * as vscode from "vscode";
import { exec } from "child_process";
import * as path from "path";

const DIAGNOSTIC_SOURCE = "codegoat";

interface Finding {
  file: string;
  line: number | null;
  severity: "critical" | "warning" | "info" | "style";
  message: string;
}

interface ReviewOutput {
  findings: Finding[];
  counts: { critical: number; warning: number; info: number; style: number };
  maxSeverity: string | null;
  filesScanned: number;
}

const SEVERITY_MAP: Record<string, vscode.DiagnosticSeverity> = {
  critical: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  info: vscode.DiagnosticSeverity.Information,
  style: vscode.DiagnosticSeverity.Hint,
};

let diagnosticCollection: vscode.DiagnosticCollection;
let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  diagnosticCollection = vscode.languages.createDiagnosticCollection(DIAGNOSTIC_SOURCE);
  outputChannel = vscode.window.createOutputChannel("codegoat");

  // Status bar
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.text = "$(eye) codegoat";
  statusBarItem.tooltip = "Click to review current file";
  statusBarItem.command = "codegoat.reviewFile";
  statusBarItem.show();

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("codegoat.reviewFile", () => reviewFile()),
    vscode.commands.registerCommand("codegoat.reviewWorkspace", () => reviewWorkspace()),
    vscode.commands.registerCommand("codegoat.clearDiagnostics", () => {
      diagnosticCollection.clear();
      statusBarItem.text = "$(eye) codegoat";
    }),
    diagnosticCollection,
    statusBarItem,
    outputChannel,
  );

  // Review on save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      const config = vscode.workspace.getConfiguration("codegoat");
      if (config.get<boolean>("reviewOnSave")) {
        reviewDocument(doc);
      }
    })
  );
}

export function deactivate() {
  diagnosticCollection?.dispose();
}

async function reviewFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No active file to review.");
    return;
  }
  await reviewDocument(editor.document);
}

async function reviewWorkspace() {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showWarningMessage("No workspace folder open.");
    return;
  }
  await runReview(workspaceFolder.uri.fsPath);
}

async function reviewDocument(doc: vscode.TextDocument) {
  const filePath = doc.uri.fsPath;
  const dir = path.dirname(filePath);
  await runReview(dir, path.basename(filePath));
}

async function runReview(targetPath: string, _filename?: string) {
  const config = vscode.workspace.getConfiguration("codegoat");
  const cliPath = config.get<string>("cliPath") || "codegoat";
  const provider = config.get<string>("provider") || "openai";
  const model = config.get<string>("model") || "";
  const severity = config.get<string>("severity") || "info";

  const args = [
    "review", targetPath,
    "--format", "json",
    "--quiet",
    "--severity", severity,
    "--provider", provider,
  ];
  if (model) args.push("--model", model);

  const cmd = `${cliPath} ${args.join(" ")}`;

  statusBarItem.text = "$(loading~spin) codegoat reviewing...";
  outputChannel.appendLine(`Running: ${cmd}`);

  try {
    const output = await execAsync(cmd, { cwd: targetPath });
    const result: ReviewOutput = JSON.parse(output);
    applyDiagnostics(result, targetPath);

    const total = result.counts.critical + result.counts.warning + result.counts.info + result.counts.style;
    if (total === 0) {
      statusBarItem.text = "$(check) codegoat: clean";
      vscode.window.showInformationMessage(`codegoat: No issues found (${result.filesScanned} files scanned)`);
    } else {
      const parts: string[] = [];
      if (result.counts.critical > 0) parts.push(`${result.counts.critical} critical`);
      if (result.counts.warning > 0) parts.push(`${result.counts.warning} warning`);
      if (result.counts.info > 0) parts.push(`${result.counts.info} info`);
      if (result.counts.style > 0) parts.push(`${result.counts.style} style`);
      statusBarItem.text = `$(alert) codegoat: ${parts.join(", ")}`;
      vscode.window.showWarningMessage(`codegoat: ${total} finding(s) — ${parts.join(", ")}`);
    }
  } catch (err: any) {
    statusBarItem.text = "$(error) codegoat: error";
    outputChannel.appendLine(`Error: ${err.message || err}`);
    vscode.window.showErrorMessage(`codegoat error: ${err.message || "Review failed"}`);
  }
}

function applyDiagnostics(result: ReviewOutput, basePath: string) {
  // Group findings by file
  const byFile = new Map<string, vscode.Diagnostic[]>();

  for (const finding of result.findings) {
    const filePath = path.isAbsolute(finding.file)
      ? finding.file
      : path.join(basePath, finding.file);
    const uri = vscode.Uri.file(filePath);
    const key = uri.toString();

    if (!byFile.has(key)) byFile.set(key, []);

    const line = Math.max(0, (finding.line ?? 1) - 1);
    const range = new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER);
    const severity = SEVERITY_MAP[finding.severity] ?? vscode.DiagnosticSeverity.Information;

    const diagnostic = new vscode.Diagnostic(range, finding.message, severity);
    diagnostic.source = DIAGNOSTIC_SOURCE;
    diagnostic.code = finding.severity;

    byFile.get(key)!.push(diagnostic);
  }

  // Apply diagnostics
  diagnosticCollection.clear();
  for (const [uriStr, diagnostics] of byFile) {
    diagnosticCollection.set(vscode.Uri.parse(uriStr), diagnostics);
  }
}

function execAsync(cmd: string, options: { cwd: string }): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: options.cwd, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr || err.message));
      } else {
        resolve(stdout);
      }
    });
  });
}
