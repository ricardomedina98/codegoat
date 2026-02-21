#!/usr/bin/env node

import { Command } from "commander";
import { runReview } from "./commands/review.js";

const program = new Command();

program
  .name("codegoat")
  .description("AI-powered code review and documentation generator")
  .version("0.1.0");

program
  .command("review")
  .description("Review code in the given path")
  .argument("<path>", "path to review")
  .option("-p, --provider <name>", "LLM provider (default: openai)", undefined)
  .option("-m, --model <name>", "model name", undefined)
  .option("-b, --budget <tokens>", "max token budget", undefined)
  .action(async (path: string, opts: { provider?: string; model?: string; budget?: string }) => {
    await runReview(path, {
      provider: opts.provider,
      model: opts.model,
      budget: opts.budget ? parseInt(opts.budget, 10) : undefined,
    });
  });

program
  .command("docs")
  .description("Generate documentation for the given path")
  .argument("<path>", "path to document")
  .action((path: string) => {
    console.log(`codegoat docs: not implemented yet (path: ${path})`);
    process.exit(0);
  });

program.parse();
