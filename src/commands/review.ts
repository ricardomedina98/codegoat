import { discoverFiles } from "../files/discover.js";
import { budgetFiles } from "../files/budget.js";
import { createProvider } from "../providers/factory.js";
import { buildReviewPrompt } from "../providers/prompts.js";

export interface ReviewOptions {
  provider?: string;
  model?: string;
  budget?: number;
}

export async function runReview(
  targetPath: string,
  options: ReviewOptions
): Promise<void> {
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
  console.error("");

  // 3. Build prompt and call LLM
  const provider = createProvider(options.provider);
  const messages = buildReviewPrompt(included);

  const request = {
    messages,
    model: options.model ?? process.env.CODEGOAT_MODEL,
    stream: true,
  };

  // 4. Stream output
  try {
    for await (const chunk of provider.chat(request)) {
      process.stdout.write(chunk);
    }
    process.stdout.write("\n");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\nError during review: ${message}`);
    process.exit(1);
  }
}
