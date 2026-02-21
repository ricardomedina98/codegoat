import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface DiffFile {
  path: string;
  content: string;        // full file content (or contextual window)
  sizeBytes: number;
  diff: string;           // the unified diff for this file
  linesAdded: number;
  linesRemoved: number;
}

export interface DiffResult {
  files: DiffFile[];
  totalAdded: number;
  totalRemoved: number;
}

const SUPPORTED_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".go", ".rb", ".java", ".rs", ".c", ".h", ".cpp", ".hpp", ".cc", ".php",
]);

const MAX_CONTEXT_LINES = 50;
const SMALL_FILE_THRESHOLD = 300;

function isGitRepo(dir: string): boolean {
  try {
    execSync("git rev-parse --is-inside-work-tree", { cwd: dir, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function getGitRoot(dir: string): string {
  return execSync("git rev-parse --show-toplevel", { cwd: dir, stdio: "pipe" })
    .toString()
    .trim();
}

function getDiffOutput(dir: string, diffArg?: string): string {
  if (diffArg) {
    return execSync(`git diff ${diffArg}`, { cwd: dir, stdio: "pipe", maxBuffer: 10 * 1024 * 1024 })
      .toString();
  }

  // Try staged first, fall back to unstaged
  const staged = execSync("git diff --cached", { cwd: dir, stdio: "pipe", maxBuffer: 10 * 1024 * 1024 }).toString();
  if (staged.trim()) return staged;

  return execSync("git diff", { cwd: dir, stdio: "pipe", maxBuffer: 10 * 1024 * 1024 }).toString();
}

function getChangedFiles(dir: string, diffArg?: string): string[] {
  let cmd: string;
  if (diffArg) {
    cmd = `git diff --name-only ${diffArg}`;
  } else {
    // Try staged first
    const staged = execSync("git diff --cached --name-only", { cwd: dir, stdio: "pipe" }).toString().trim();
    if (staged) return staged.split("\n").filter(Boolean);
    cmd = "git diff --name-only";
  }
  return execSync(cmd, { cwd: dir, stdio: "pipe" }).toString().trim().split("\n").filter(Boolean);
}

function getFileDiff(fullDiff: string, filePath: string): string {
  const lines = fullDiff.split("\n");
  let capturing = false;
  const result: string[] = [];

  for (const line of lines) {
    if (line.startsWith("diff --git")) {
      if (capturing) break; // next file starts
      if (line.includes(`b/${filePath}`)) {
        capturing = true;
      }
    }
    if (capturing) {
      result.push(line);
    }
  }

  return result.join("\n");
}

function extractHunkLines(diff: string): Set<number> {
  const changed = new Set<number>();
  const lines = diff.split("\n");
  let currentLine = 0;

  for (const line of lines) {
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      currentLine = parseInt(hunkMatch[1], 10);
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      changed.add(currentLine);
      currentLine++;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      // deleted lines don't increment current line in new file
    } else {
      currentLine++;
    }
  }

  return changed;
}

function buildContextContent(
  fullContent: string,
  diff: string
): string {
  const allLines = fullContent.split("\n");

  // Small file: include everything
  if (allLines.length <= SMALL_FILE_THRESHOLD) {
    return formatWithMarkers(allLines, extractHunkLines(diff));
  }

  // Large file: window around changed lines
  const changedLines = extractHunkLines(diff);
  const includeLines = new Set<number>();

  for (const line of changedLines) {
    for (let i = Math.max(1, line - MAX_CONTEXT_LINES); i <= Math.min(allLines.length, line + MAX_CONTEXT_LINES); i++) {
      includeLines.add(i);
    }
  }

  // Also include imports (first 30 lines typically)
  for (let i = 1; i <= Math.min(30, allLines.length); i++) {
    includeLines.add(i);
  }

  const sortedLines = [...includeLines].sort((a, b) => a - b);
  const result: string[] = [];
  let lastLine = 0;

  for (const lineNum of sortedLines) {
    if (lineNum > lastLine + 1 && lastLine > 0) {
      result.push("...");
    }
    const idx = lineNum - 1;
    if (idx < allLines.length) {
      const marker = changedLines.has(lineNum) ? "[changed]" : "[context]";
      result.push(`${lineNum} | ${marker} ${allLines[idx]}`);
    }
    lastLine = lineNum;
  }

  return result.join("\n");
}

function formatWithMarkers(allLines: string[], changedLines: Set<number>): string {
  return allLines
    .map((line, i) => {
      const lineNum = i + 1;
      const marker = changedLines.has(lineNum) ? "[changed]" : "[context]";
      return `${lineNum} | ${marker} ${line}`;
    })
    .join("\n");
}

function countDiffStats(diff: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) added++;
    if (line.startsWith("-") && !line.startsWith("---")) removed++;
  }
  return { added, removed };
}

export function discoverDiffFiles(
  targetPath: string,
  diffArg?: string
): DiffResult {
  const resolvedPath = path.resolve(targetPath);

  if (!isGitRepo(resolvedPath)) {
    console.error("Error: --diff requires a git repository.");
    process.exit(1);
  }

  const gitRoot = getGitRoot(resolvedPath);
  const changedPaths = getChangedFiles(gitRoot, diffArg);
  const fullDiff = getDiffOutput(gitRoot, diffArg);

  const files: DiffFile[] = [];
  let totalAdded = 0;
  let totalRemoved = 0;

  for (const filePath of changedPaths) {
    const ext = path.extname(filePath);
    if (!SUPPORTED_EXTENSIONS.has(ext)) continue;

    const fullPath = path.join(gitRoot, filePath);
    if (!fs.existsSync(fullPath)) continue; // deleted file

    const fullContent = fs.readFileSync(fullPath, "utf-8");
    const fileDiff = getFileDiff(fullDiff, filePath);
    const stats = countDiffStats(fileDiff);
    const content = buildContextContent(fullContent, fileDiff);

    files.push({
      path: filePath,
      content,
      sizeBytes: Buffer.byteLength(content, "utf-8"),
      diff: fileDiff,
      linesAdded: stats.added,
      linesRemoved: stats.removed,
    });

    totalAdded += stats.added;
    totalRemoved += stats.removed;
  }

  return { files, totalAdded, totalRemoved };
}
