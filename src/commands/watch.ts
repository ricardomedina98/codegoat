import fs from "node:fs";
import path from "node:path";
import ignore, { type Ignore } from "ignore";
import { createProvider } from "../providers/factory.js";
import { buildReviewPrompt } from "../providers/prompts.js";
import { parseFindings, filterBySeverity, countBySeverity, SEVERITY_EMOJI, severityFromString, type Severity } from "../output/severity.js";

const SUPPORTED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".go"]);
const MAX_FILE_SIZE = 50 * 1024;

export interface WatchOptions {
  provider?: string;
  model?: string;
  severity?: string;
  rules?: string[];
  noIgnore?: boolean;
  debounceMs?: number;
}

function loadIgnoreFilter(rootPath: string, noIgnore?: boolean): Ignore {
  const ig = ignore();
  for (const file of [".gitignore", ...(noIgnore ? [] : [".codegoatignore"])]) {
    try {
      ig.add(fs.readFileSync(path.join(rootPath, file), "utf-8"));
    } catch { /* missing file */ }
  }
  return ig;
}

function shouldReview(filePath: string, rootPath: string, ig: Ignore): boolean {
  const ext = path.extname(filePath);
  if (!SUPPORTED_EXTENSIONS.has(ext)) return false;
  const rel = path.relative(rootPath, filePath);
  if (ig.ignores(rel)) return false;
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_FILE_SIZE || stat.size === 0) return false;
  } catch { return false; }
  return true;
}

export function createDebouncer(delayMs: number): {
  push(filePath: string): void;
  onFlush(cb: (files: string[]) => void): void;
  destroy(): void;
} {
  let pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let callback: ((files: string[]) => void) | null = null;

  return {
    push(filePath: string) {
      pending.add(filePath);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const files = [...pending];
        pending = new Set();
        timer = null;
        if (callback && files.length > 0) callback(files);
      }, delayMs);
    },
    onFlush(cb: (files: string[]) => void) { callback = cb; },
    destroy() { if (timer) clearTimeout(timer); },
  };
}

export async function runWatch(
  targetPath: string,
  options: WatchOptions
): Promise<void> {
  const rootPath = path.resolve(targetPath);
  const ig = loadIgnoreFilter(rootPath, options.noIgnore);
  const debounceMs = options.debounceMs ?? 500;
  const threshold = severityFromString(options.severity ?? "info");
  const provider = createProvider(options.provider);

  console.error(`\n🔍 Watching ${rootPath} for changes... (Ctrl+C to stop)\n`);

  const debouncer = createDebouncer(debounceMs);

  debouncer.onFlush(async (files) => {
    const reviewable = files.filter(f => shouldReview(f, rootPath, ig));
    if (reviewable.length === 0) return;

    const fileContents = reviewable.map(f => {
      const rel = path.relative(rootPath, f);
      const content = fs.readFileSync(f, "utf-8");
      return { path: rel, content, sizeBytes: Buffer.byteLength(content) };
    });

    const names = fileContents.map(f => f.path).join(", ");
    console.error(`\n${"─".repeat(60)}`);
    console.error(`📝 Change detected: ${names}`);
    console.error(`${"─".repeat(60)}\n`);

    try {
      const messages = buildReviewPrompt(fileContents, options.rules);
      const request = { messages: messages as any, model: options.model ?? process.env.CODEGOAT_MODEL, stream: true };
      let raw = "";

      for await (const chunk of provider.chat(request)) {
        process.stdout.write(chunk);
        raw += chunk;
      }
      process.stdout.write("\n");

      // Severity summary
      const parsed = parseFindings(raw);
      const counts = countBySeverity(parsed.findings);
      const filtered = filterBySeverity(parsed.findings, threshold);
      const parts = (["critical", "warning", "info", "style"] as Severity[])
        .filter(s => counts[s] > 0)
        .map(s => `${SEVERITY_EMOJI[s]} ${counts[s]} ${s}`);
      const hidden = parsed.findings.length - filtered.length;
      const hiddenNote = hidden > 0 ? ` (${hidden} below threshold hidden)` : "";
      console.error(`\n📊 ${fileContents.length} file(s) · ${parts.join(" · ") || "no findings"}${hiddenNote}`);
      console.error(`\n🔍 Watching for more changes...\n`);
    } catch (err) {
      console.error(`\n❌ Review error: ${err instanceof Error ? err.message : String(err)}`);
      console.error(`🔍 Watching for more changes...\n`);
    }
  });

  // Use recursive fs.watch (Node 18+ on Linux/macOS/Windows)
  const watcher = fs.watch(rootPath, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    const fullPath = path.join(rootPath, filename);
    debouncer.push(fullPath);
  });

  // Clean shutdown
  const cleanup = () => {
    console.error("\n\n👋 Stopping watch mode...");
    debouncer.destroy();
    watcher.close();
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Keep process alive
  await new Promise(() => {});
}
