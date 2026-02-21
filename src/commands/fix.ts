import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { execSync } from "node:child_process";
import { discoverFiles } from "../files/discover.js";
import { budgetFiles } from "../files/budget.js";
import { createProvider } from "../providers/factory.js";
import { buildReviewPrompt } from "../providers/prompts.js";
import { parseFindings, filterBySeverity, severityFromString, SEVERITY_EMOJI, type Finding } from "../output/severity.js";
import { info, debug, warn, error as logError } from "../output/logger.js";

const CONTEXT_LINES = 15; // 15 above + 15 below = 30-line window

export interface FixOptions {
  provider?: string;
  model?: string;
  budget?: number;
  severity?: string;
  apply?: boolean;
  dryRun?: boolean;
  diff?: boolean | string;
  noIgnore?: boolean;
  rules?: string[];
  format?: "markdown" | "json";
}

interface FixResult {
  file: string;
  line: number;
  originalLines: string[];
  fixedLines: string[];
  finding: Finding;
}

const FIX_SYSTEM_PROMPT = `You are a code fix generator. Given a code snippet with a specific issue, generate the MINIMAL fix.

Rules:
- Output ONLY the fixed code lines — no explanations, no markdown fences, no surrounding code
- Change as few lines as possible — don't rewrite or refactor
- Preserve indentation, style, and surrounding code exactly
- If the fix requires adding lines, include them
- If the fix requires removing lines, omit them
- Output the replacement for the exact lines provided in the context window`;

/**
 * Extract a context window around a specific line.
 */
export function extractContext(
  content: string,
  targetLine: number,
  contextLines: number = CONTEXT_LINES
): { lines: string[]; startLine: number; endLine: number } {
  const allLines = content.split("\n");
  const startLine = Math.max(0, targetLine - 1 - contextLines);
  const endLine = Math.min(allLines.length, targetLine - 1 + contextLines + 1);
  return {
    lines: allLines.slice(startLine, endLine),
    startLine: startLine + 1,
    endLine,
  };
}

/**
 * Generate a fix for a single finding using the LLM.
 */
async function generateFix(
  provider: ReturnType<typeof createProvider>,
  filePath: string,
  content: string,
  finding: Finding,
  model?: string
): Promise<FixResult | null> {
  const line = finding.line ?? 1;
  const { lines, startLine, endLine } = extractContext(content, line);

  const numberedLines = lines.map((l, i) => `${startLine + i}: ${l}`).join("\n");

  const userPrompt = `File: ${filePath}
Issue on line ${line}: ${SEVERITY_EMOJI[finding.severity]} ${finding.severity} — ${finding.message}

Code context (lines ${startLine}-${endLine}):
\`\`\`
${numberedLines}
\`\`\`

Generate the fixed version of ONLY the lines that need to change. Include line numbers in the same format.`;

  const messages = [
    { role: "system" as const, content: FIX_SYSTEM_PROMPT },
    { role: "user" as const, content: userPrompt },
  ];

  let raw = "";
  try {
    for await (const chunk of provider.chat({ messages, model, stream: true })) {
      raw += chunk;
    }
  } catch (err) {
    warn(`Failed to generate fix for ${filePath}:${line}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }

  // Parse the fix output — extract line-numbered content
  const fixedLines = parseFixOutput(raw, startLine, endLine);
  if (!fixedLines) return null;

  return {
    file: filePath,
    line,
    originalLines: lines,
    fixedLines,
    finding,
  };
}

/**
 * Parse LLM fix output into lines.
 */
export function parseFixOutput(raw: string, startLine: number, endLine: number): string[] | null {
  // Try to extract from code fences first
  const fenceMatch = raw.match(/```[\w]*\n([\s\S]*?)```/);
  const content = fenceMatch ? fenceMatch[1] : raw;

  const trimmed = content.trim();
  if (!trimmed) return null;
  const lines = trimmed.split("\n");

  // Check if lines have line numbers (e.g., "42: const x = 1;")
  const numbered = lines.every(l => /^\d+:\s/.test(l));
  if (numbered) {
    return lines.map(l => l.replace(/^\d+:\s/, ""));
  }

  return lines;
}

/**
 * Apply a fix to a file.
 */
function applyFix(rootPath: string, fix: FixResult): void {
  const filePath = path.isAbsolute(fix.file) ? fix.file : path.join(rootPath, fix.file);
  const content = fs.readFileSync(filePath, "utf-8");
  const allLines = content.split("\n");

  const { startLine } = extractContext(content, fix.line);
  const endIdx = startLine - 1 + fix.originalLines.length;

  // Replace the context window with fixed lines
  allLines.splice(startLine - 1, fix.originalLines.length, ...fix.fixedLines);

  fs.writeFileSync(filePath, allLines.join("\n"));
}

/**
 * Generate a unified diff preview.
 */
export function generateDiffPreview(fix: FixResult): string {
  const lines: string[] = [];
  lines.push(`--- a/${fix.file}`);
  lines.push(`+++ b/${fix.file}`);
  lines.push(`@@ finding: ${SEVERITY_EMOJI[fix.finding.severity]} ${fix.finding.severity} (line ${fix.line}) @@`);

  // Simple diff: show removed and added lines
  const maxLen = Math.max(fix.originalLines.length, fix.fixedLines.length);
  for (let i = 0; i < fix.originalLines.length; i++) {
    if (i < fix.fixedLines.length && fix.originalLines[i] === fix.fixedLines[i]) {
      lines.push(` ${fix.originalLines[i]}`);
    } else {
      lines.push(`\x1b[31m-${fix.originalLines[i]}\x1b[0m`);
    }
  }
  for (let i = 0; i < fix.fixedLines.length; i++) {
    if (i >= fix.originalLines.length || fix.originalLines[i] !== fix.fixedLines[i]) {
      lines.push(`\x1b[32m+${fix.fixedLines[i]}\x1b[0m`);
    }
  }

  return lines.join("\n");
}

/**
 * Git stash safety.
 */
function gitStash(rootPath: string): boolean {
  try {
    const result = execSync("git stash push -m 'codegoat-fix-backup'", { cwd: rootPath, encoding: "utf-8" });
    return !result.includes("No local changes");
  } catch { return false; }
}

function gitStashPop(rootPath: string): void {
  try { execSync("git stash pop", { cwd: rootPath }); } catch { /* best effort */ }
}

/**
 * Interactive prompt for a single fix.
 */
async function promptUser(rl: readline.Interface, fix: FixResult): Promise<"apply" | "skip" | "quit"> {
  console.error(`\n${SEVERITY_EMOJI[fix.finding.severity]} ${fix.finding.severity} — ${fix.file}:${fix.line}`);
  console.error(`  ${fix.finding.message}\n`);
  console.error(generateDiffPreview(fix));

  return new Promise((resolve) => {
    rl.question("\n  [a]pply  [s]kip  [q]uit → ", (answer) => {
      const a = answer.trim().toLowerCase();
      if (a === "a" || a === "apply") resolve("apply");
      else if (a === "q" || a === "quit") resolve("quit");
      else resolve("skip");
    });
  });
}

/**
 * Main fix command.
 */
export async function runFix(
  targetPath: string,
  options: FixOptions
): Promise<void> {
  const rootPath = path.resolve(targetPath);
  const format = options.format ?? "markdown";

  // Phase 1: Review
  info("Phase 1: Running review...\n");
  const files = await discoverFiles(targetPath, { noIgnore: options.noIgnore });
  if (files.length === 0) {
    info("No supported files found.");
    return;
  }

  const maxTokens = options.budget ?? parseInt(process.env.CODEGOAT_MAX_TOKENS ?? "100000", 10);
  const { included } = budgetFiles(files, maxTokens);
  if (included.length === 0) {
    info("No files fit within the token budget.");
    return;
  }

  const provider = createProvider(options.provider);
  const messages = buildReviewPrompt(included, options.rules);
  let reviewRaw = "";
  for await (const chunk of provider.chat({ messages: messages as any, model: options.model, stream: true })) {
    reviewRaw += chunk;
  }

  const parsed = parseFindings(reviewRaw);
  const threshold = severityFromString(options.severity ?? "info");
  const findings = filterBySeverity(parsed.findings, threshold)
    .filter(f => f.file && f.line); // only fixable findings (have file + line)

  if (findings.length === 0) {
    info("✅ No fixable findings. Code looks good!");
    return;
  }

  info(`Found ${findings.length} fixable finding(s).\n`);

  // JSON output mode (for VS Code integration)
  if (format === "json") {
    const fixes: FixResult[] = [];
    for (const finding of findings) {
      const fileObj = included.find(f => f.path === finding.file);
      if (!fileObj) continue;
      info(`Generating fix for ${finding.file}:${finding.line}...`);
      const fix = await generateFix(provider, finding.file, fileObj.content, finding, options.model);
      if (fix) fixes.push(fix);
    }
    const jsonOut = fixes.map(f => ({
      file: f.file,
      line: f.line,
      severity: f.finding.severity,
      message: f.finding.message,
      originalLines: f.originalLines,
      fixedLines: f.fixedLines,
    }));
    process.stdout.write(JSON.stringify(jsonOut, null, 2) + "\n");
    return;
  }

  // Phase 2: Generate and apply fixes
  info("Phase 2: Generating fixes...\n");

  // Git stash safety (unless dry-run)
  let stashed = false;
  if (!options.dryRun && !options.apply) {
    // Interactive mode — stash for safety
    stashed = gitStash(rootPath);
    if (stashed) debug("Git stash created for safety.");
  }

  const rl = !options.apply && !options.dryRun
    ? readline.createInterface({ input: process.stdin, output: process.stderr })
    : null;

  let applied = 0;
  let skipped = 0;

  try {
    for (const finding of findings) {
      const fileObj = included.find(f => f.path === finding.file);
      if (!fileObj) { skipped++; continue; }

      // Lazy fix generation
      info(`\nGenerating fix for ${finding.file}:${finding.line}...`);
      const fix = await generateFix(provider, finding.file, fileObj.content, finding, options.model);
      if (!fix) { skipped++; continue; }

      if (options.dryRun) {
        // Show diff but don't apply
        console.error(`\n${SEVERITY_EMOJI[finding.severity]} ${finding.severity} — ${finding.file}:${finding.line}`);
        console.error(`  ${finding.message}\n`);
        console.error(generateDiffPreview(fix));
        skipped++;
      } else if (options.apply) {
        // Auto-apply
        applyFix(rootPath, fix);
        applied++;
        info(`  ✅ Applied fix to ${fix.file}:${fix.line}`);
      } else if (rl) {
        // Interactive
        const action = await promptUser(rl, fix);
        if (action === "apply") {
          applyFix(rootPath, fix);
          applied++;
          // Re-read file content for subsequent fixes on same file
          const newContent = fs.readFileSync(path.join(rootPath, fix.file), "utf-8");
          fileObj.content = newContent;
        } else if (action === "quit") {
          break;
        } else {
          skipped++;
        }
      }
    }
  } catch (err) {
    logError(`Fix failed: ${err instanceof Error ? err.message : String(err)}`);
    if (stashed) {
      warn("Restoring git stash due to error...");
      gitStashPop(rootPath);
    }
    throw err;
  } finally {
    rl?.close();
  }

  console.error(`\n📊 ${applied} fix(es) applied, ${skipped} skipped`);
  if (stashed && applied === 0) {
    gitStashPop(rootPath);
    debug("No fixes applied, git stash restored.");
  }
}
