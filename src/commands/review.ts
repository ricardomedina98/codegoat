import { discoverFiles } from "../files/discover.js";
import { budgetFiles } from "../files/budget.js";
import { createProvider } from "../providers/factory.js";
import { buildReviewPrompt } from "../providers/prompts.js";
import { formatMarkdown, formatJson, type ReviewResult } from "../output/formatter.js";
import { shouldColor } from "../output/color.js";
import { createSpinner } from "../output/progress.js";

export interface ReviewOptions {
  provider?: string;
  model?: string;
  budget?: number;
  format?: "markdown" | "json";
  noColor?: boolean;
}

export async function runReview(
  targetPath: string,
  options: ReviewOptions
): Promise<void> {
  const format = options.format ?? "markdown";
  const useColor = shouldColor(options.noColor ?? false);

  // 1. Discover files
  console.error(`Scanning ${targetPath}...`);
  const files = await discoverFiles(targetPath);

  if (files.length === 0) {
    console.error("No supported files found. codegoat reviews .ts, .tsx, .js, .jsx, .mjs, .cjs files.");
    process.exit(0);
  }

  // 2. Budget
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

  // 3. Build prompt and call LLM
  const provider = createProvider(options.provider);
  const messages = buildReviewPrompt(included);
  const request = {
    messages,
    model: options.model ?? process.env.CODEGOAT_MODEL,
    stream: true,
  };

  // 4. Stream and collect output
  const spinner = createSpinner("Reviewing code...");
  let raw = "";
  let firstChunk = true;

  try {
    for await (const chunk of provider.chat(request)) {
      if (firstChunk) {
        spinner.stop();
        firstChunk = false;
        // In markdown mode, stream as we go
        if (format === "markdown") {
          process.stdout.write(chunk);
        }
      } else if (format === "markdown") {
        process.stdout.write(chunk);
      }
      raw += chunk;
    }

    if (firstChunk) spinner.stop(); // no chunks received

    if (format === "markdown") {
      process.stdout.write("\n");
    }
  } catch (err) {
    spinner.stop();
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\nError during review: ${message}`);
    process.exit(1);
  }

  // 5. Format final output
  const result: ReviewResult = {
    raw,
    filesScanned: included.length,
    filesSkipped: skipped.length,
    estimatedTokens: totalTokens,
  };

  if (format === "json") {
    process.stdout.write(formatJson(result) + "\n");
  } else {
    // Print summary header to stderr (review body already streamed to stdout)
    const total = included.length + skipped.length;
    const skipNote = skipped.length > 0 ? ` (${skipped.length} skipped)` : "";
    console.error(`\n📊 ${total} files found, ${included.length} reviewed${skipNote}, ${totalTokens.toLocaleString()} tokens`);
  }
}
