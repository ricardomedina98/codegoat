import { discoverFiles } from "../files/discover.js";
import { budgetFiles } from "../files/budget.js";
import { discoverDiffFiles } from "../files/diff.js";
import { createProvider } from "../providers/factory.js";
import { buildReviewPrompt, buildDiffReviewPrompt } from "../providers/prompts.js";
import { formatMarkdown, formatJson, type ReviewResult } from "../output/formatter.js";
import { shouldColor } from "../output/color.js";
import { createSpinner } from "../output/progress.js";

export interface ReviewOptions {
  provider?: string;
  model?: string;
  budget?: number;
  format?: "markdown" | "json";
  noColor?: boolean;
  diff?: boolean | string;
}

export async function runReview(
  targetPath: string,
  options: ReviewOptions
): Promise<void> {
  const format = options.format ?? "markdown";
  const useColor = shouldColor(options.noColor ?? false);

  if (options.diff !== undefined && options.diff !== false) {
    return runDiffReview(targetPath, options, format);
  }

  // --- Full repo review ---
  console.error(`Scanning ${targetPath}...`);
  const files = await discoverFiles(targetPath);

  if (files.length === 0) {
    console.error("No supported files found. codegoat supports .ts, .tsx, .js, .jsx, .mjs, .cjs, .py, .go files.");
    process.exit(0);
  }

  const maxTokens = options.budget ?? parseInt(process.env.CODEGOAT_MAX_TOKENS ?? "100000", 10);
  const { included, skipped, totalTokens } = budgetFiles(files, maxTokens);

  console.error(`Found ${files.length} files. Reviewing ${included.length} (${totalTokens} estimated tokens).`);
  if (skipped.length > 0) {
    console.error(`Skipped ${skipped.length} files (over token budget):`);
    for (const f of skipped) {
      console.error(`  - ${f.path}`);
    }
  }

  if (included.length === 0) {
    console.error("\nNo files fit within the token budget. Try increasing --budget.");
    process.exit(0);
  }

  console.error("");

  const provider = createProvider(options.provider);
  const messages = buildReviewPrompt(included);
  const request = { messages, model: options.model ?? process.env.CODEGOAT_MODEL, stream: true };

  const spinner = createSpinner("Reviewing code...");
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

  const result: ReviewResult = { raw, filesScanned: included.length, filesSkipped: skipped.length, estimatedTokens: totalTokens };

  if (format === "json") {
    process.stdout.write(formatJson(result) + "\n");
  } else {
    const total = included.length + skipped.length;
    const skipNote = skipped.length > 0 ? ` (${skipped.length} skipped)` : "";
    console.error(`\n📊 ${total} files found, ${included.length} reviewed${skipNote}, ${totalTokens.toLocaleString()} tokens`);
  }
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
  const messages = buildDiffReviewPrompt(diffFiles, totalAdded, totalRemoved);
  const request = { messages, model: options.model ?? process.env.CODEGOAT_MODEL, stream: true };

  const spinner = createSpinner("Reviewing changes...");
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

  const result: ReviewResult = { raw, filesScanned: included.length, filesSkipped: skipped.length, estimatedTokens: totalTokens };

  if (format === "json") {
    process.stdout.write(formatJson(result) + "\n");
  } else {
    console.error(`\n📊 ${files.length} changed files, ${included.length} reviewed, +${totalAdded} -${totalRemoved}, ${totalTokens.toLocaleString()} tokens`);
  }
}
