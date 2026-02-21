#!/usr/bin/env node

import { Command } from "commander";
import { runReview } from "./commands/review.js";
import { runDocs } from "./commands/docs.js";

const program = new Command();

program
  .name("codegoat")
  .description("AI-powered code review and documentation generator")
  .version("0.1.0");

program
  .command("review")
  .description("Review code in the given path")
  .argument("<path>", "path to review")
  .option("-p, --provider <name>", "LLM provider (default: openai)")
  .option("-m, --model <name>", "model name")
  .option("-b, --budget <tokens>", "max token budget")
  .option("-f, --format <type>", "output format: markdown or json", "markdown")
  .option("--no-color", "disable color output")
  .action(async (path: string, opts: { provider?: string; model?: string; budget?: string; format?: string; color?: boolean }) => {
    await runReview(path, {
      provider: opts.provider,
      model: opts.model,
      budget: opts.budget ? parseInt(opts.budget, 10) : undefined,
      format: (opts.format === "json" ? "json" : "markdown") as "markdown" | "json",
      noColor: opts.color === false,
    });
  });

program
  .command("docs")
  .description("Generate documentation for the given path")
  .argument("<path>", "path to document")
  .option("-p, --provider <name>", "LLM provider (default: openai)")
  .option("-m, --model <name>", "model name")
  .option("-b, --budget <tokens>", "max token budget")
  .option("-l, --level <level>", "doc level: project, file, or function", "project")
  .action(async (path: string, opts: { provider?: string; model?: string; budget?: string; level?: string }) => {
    const level = (["project", "file", "function"].includes(opts.level ?? "")
      ? opts.level
      : "project") as "project" | "file" | "function";
    await runDocs(path, {
      provider: opts.provider,
      model: opts.model,
      budget: opts.budget ? parseInt(opts.budget, 10) : undefined,
      level,
    });
  });

program.parse();
