import { discoverFiles } from "../files/discover.js";
import { budgetFiles } from "../files/budget.js";
import { createProvider } from "../providers/factory.js";
import { buildDocsPrompt, type DocsLevel } from "../providers/prompts.js";
import { createSpinner } from "../output/progress.js";

export interface DocsOptions {
  provider?: string;
  model?: string;
  budget?: number;
  level?: DocsLevel;
}

export async function runDocs(
  targetPath: string,
  options: DocsOptions
): Promise<void> {
  const level = options.level ?? "project";

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

  console.error(`Found ${files.length} files. Documenting ${included.length} (${totalTokens} estimated tokens).`);
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

  console.error(`\nGenerating ${level}-level documentation...\n`);

  // 3. Build prompt and call LLM
  const provider = createProvider(options.provider);
  const messages = buildDocsPrompt(included, level);
  const request = {
    messages,
    model: options.model ?? process.env.CODEGOAT_MODEL,
    stream: true,
  };

  // 4. Stream output
  const spinner = createSpinner("Generating documentation...");
  let firstChunk = true;

  try {
    for await (const chunk of provider.chat(request)) {
      if (firstChunk) {
        spinner.stop();
        firstChunk = false;
      }
      process.stdout.write(chunk);
    }
    if (firstChunk) spinner.stop();
    process.stdout.write("\n");
  } catch (err) {
    spinner.stop();
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\nError during documentation generation: ${message}`);
    process.exit(1);
  }
}
