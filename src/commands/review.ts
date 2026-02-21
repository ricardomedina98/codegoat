import { discoverFiles } from "../files/discover.js";
import { budgetFiles } from "../files/budget.js";
import { discoverDiffFiles } from "../files/diff.js";
import { createProvider } from "../providers/factory.js";
import { buildReviewPrompt, buildDiffReviewPrompt } from "../providers/prompts.js";
import { type ReviewResult } from "../output/formatter.js";
import { shouldColor } from "../output/color.js";
import { createSpinner } from "../output/progress.js";
import {
  parseFindings, filterBySeverity, getMaxSeverity, countBySeverity,
  severityFromString, SEVERITY_EMOJI, SEVERITY_ORDER, type Severity,
} from "../output/severity.js";

export interface ReviewOptions {
  provider?: string;
  model?: string;
  budget?: number;
  format?: "markdown" | "json";
  noColor?: boolean;
  diff?: boolean | string;
  severity?: string;
  failOn?: string;
  noIgnore?: boolean;
  rules?: string[];
}

export async function runReview(
  targetPath: string,
  options: ReviewOptions
): Promise<void> {
  const format = options.format ?? "markdown";

  if (options.diff !== undefined && options.diff !== false) {
    return runDiffReview(targetPath, options, format);
  }

  console.error(`Scanning ${targetPath}...`);
  const files = await discoverFiles(targetPath, { noIgnore: options.noIgnore });

  if (files.length === 0) {
    console.error("No supported files found. codegoat supports .ts, .tsx, .js, .jsx, .mjs, .cjs, .py, .go files.");
    process.exit(0);
  }

  const maxTokens = options.budget ?? parseInt(process.env.CODEGOAT_MAX_TOKENS ?? "100000", 10);
  const { included, skipped, totalTokens } = budgetFiles(files, maxTokens);

  console.error(`Found ${files.length} files. Reviewing ${included.length} (${totalTokens} estimated tokens).`);
  if (skipped.length > 0) {
    console.error(`Skipped ${skipped.length} files (over token budget):`);
    for (const f of skipped) console.error(`  - ${f.path}`);
  }

  if (included.length === 0) {
    console.error("\nNo files fit within the token budget. Try increasing --budget.");
    process.exit(0);
  }

  console.error("");

  const provider = createProvider(options.provider);
  const messages = buildReviewPrompt(included, options.rules);
  const raw = await streamLLM(provider, messages, options, format);

  handleOutput(
    { raw, filesScanned: included.length, filesSkipped: skipped.length, estimatedTokens: totalTokens },
    format, options
  );
}

async function runDiffReview(
  targetPath: string,
  options: ReviewOptions,
  format: "markdown" | "json"
): Promise<void> {
  const diffArg = typeof options.diff === "string" ? options.diff : undefined;

  console.error(`Scanning diff${diffArg ? ` (${diffArg})` : ""}...`);
  const { files, totalAdded, totalRemoved } = discoverDiffFiles(targetPath, diffArg);

  if (files.length === 0) {
    console.error("No supported changed files found in diff.");
    process.exit(0);
  }

  const maxTokens = options.budget ?? parseInt(process.env.CODEGOAT_MAX_TOKENS ?? "100000", 10);
  const { included, skipped, totalTokens } = budgetFiles(files, maxTokens);

  console.error(`${files.length} changed files (+${totalAdded} -${totalRemoved}). Reviewing ${included.length} (${totalTokens} estimated tokens).`);
  if (skipped.length > 0) {
    console.error(`Skipped ${skipped.length} files (over token budget):`);
    for (const f of skipped) console.error(`  - ${f.path}`);
  }

  if (included.length === 0) {
    console.error("\nNo files fit within the token budget. Try increasing --budget.");
    process.exit(0);
  }

  console.error("");

  const provider = createProvider(options.provider);
  const diffFiles = included as unknown as Array<{ path: string; content: string; linesAdded: number; linesRemoved: number }>;
  const messages = buildDiffReviewPrompt(diffFiles, totalAdded, totalRemoved, options.rules);
  const raw = await streamLLM(provider, messages, options, format);

  handleOutput(
    { raw, filesScanned: included.length, filesSkipped: skipped.length, estimatedTokens: totalTokens },
    format, options
  );
}

async function streamLLM(
  provider: ReturnType<typeof createProvider>,
  messages: Array<{ role: string; content: string }>,
  options: ReviewOptions,
  format: "markdown" | "json"
): Promise<string> {
  const request = { messages: messages as any, model: options.model ?? process.env.CODEGOAT_MODEL, stream: true };
  const spinner = createSpinner("Reviewing...");
  let raw = "";
  let firstChunk = true;

  try {
    for await (const chunk of provider.chat(request)) {
      if (firstChunk) { spinner.stop(); firstChunk = false; if (format === "markdown") process.stdout.write(chunk); }
      else if (format === "markdown") process.stdout.write(chunk);
      raw += chunk;
    }
    if (firstChunk) spinner.stop();
    if (format === "markdown") process.stdout.write("\n");
  } catch (err) {
    spinner.stop();
    console.error(`\nError during review: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  return raw;
}

function handleOutput(
  result: ReviewResult,
  format: "markdown" | "json",
  options: ReviewOptions
): void {
  const threshold = severityFromString(options.severity ?? process.env.CODEGOAT_SEVERITY ?? "info");
  const failOn: Severity = options.failOn === "none" ? "style" : severityFromString(options.failOn ?? "critical");

  const parsed = parseFindings(result.raw);
  const allCounts = countBySeverity(parsed.findings);
  const filtered = filterBySeverity(parsed.findings, threshold);
  const maxSev = getMaxSeverity(parsed.findings);

  if (format === "json") {
    const jsonOut = {
      version: "0.4.0",
      filesScanned: result.filesScanned,
      filesSkipped: result.filesSkipped,
      estimatedTokens: result.estimatedTokens,
      summary: parsed.summary,
      findings: filtered.map((f) => ({
        file: f.file,
        line: f.line ?? null,
        severity: f.severity,
        message: f.message,
      })),
      counts: allCounts,
      maxSeverity: maxSev,
      review: result.raw,
    };
    process.stdout.write(JSON.stringify(jsonOut, null, 2) + "\n");
  } else {
    const parts = (["critical", "warning", "info", "style"] as Severity[])
      .filter((s) => allCounts[s] > 0)
      .map((s) => `${SEVERITY_EMOJI[s]} ${allCounts[s]} ${s}`);
    const hiddenCount = parsed.findings.length - filtered.length;
    const hiddenNote = hiddenCount > 0 ? ` (${hiddenCount} below threshold hidden)` : "";
    console.error(`\n📊 ${result.filesScanned} files reviewed · ${parts.join(" · ") || "no findings"}${hiddenNote}`);
  }

  if (maxSev && SEVERITY_ORDER[maxSev] >= SEVERITY_ORDER[failOn]) {
    process.exit(1);
  }
}
