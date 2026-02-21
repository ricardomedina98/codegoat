#!/usr/bin/env node

import fs from "node:fs";
import { Command } from "commander";
import { runReview } from "./commands/review.js";
import { runWatch } from "./commands/watch.js";
import { runDocs } from "./commands/docs.js";
import { loadConfig, applyConfig, generateStarterConfig } from "./config.js";

const config = loadConfig();

const program = new Command();

program
  .name("codegoat")
  .description("AI-powered code review and documentation generator")
  .version("0.4.0");

program
  .command("review")
  .description("Review code in the given path")
  .argument("<path>", "path to review")
  .option("-p, --provider <name>", "LLM provider (default: openai)")
  .option("-m, --model <name>", "model name")
  .option("-b, --budget <tokens>", "max token budget")
  .option("-f, --format <type>", "output format: markdown or json")
  .option("-d, --diff [ref]", "review only changed files from git diff (optional: branch or range)")
  .option("-s, --severity <level>", "minimum severity to show: critical, warning, info, style", "info")
  .option("--fail-on <level>", "exit 1 if findings at this severity or above (none to disable)", "critical")
  .option("--no-ignore", "skip .codegoatignore file")
  .option("-w, --watch", "watch for file changes and re-review incrementally")
  .option("--no-color", "disable color output")
  .action(async (path: string, opts: { provider?: string; model?: string; budget?: string; format?: string; diff?: boolean | string; severity?: string; failOn?: string; ignore?: boolean; watch?: boolean; color?: boolean }) => {
    applyConfig(opts, config);
    const rules = config.rules?.filter((r: string) => !r.startsWith("//"));
    if (opts.watch) {
      await runWatch(path, {
        provider: opts.provider,
        model: opts.model,
        severity: opts.severity,
        rules,
        noIgnore: opts.ignore === false,
      });
      return;
    }
    const format = opts.format ?? config.format ?? "markdown";
    await runReview(path, {
      provider: opts.provider,
      model: opts.model,
      budget: opts.budget ? parseInt(opts.budget, 10) : undefined,
      format: (format === "json" ? "json" : "markdown") as "markdown" | "json",
      diff: opts.diff,
      severity: opts.severity,
      failOn: opts.failOn,
      noIgnore: opts.ignore === false,
      noColor: opts.color === false,
      rules,
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
    applyConfig(opts, config);
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

program
  .command("init")
  .description("Generate a starter .codegoatrc config file")
  .action(() => {
    const target = ".codegoatrc";
    if (fs.existsSync(target)) {
      console.error(`.codegoatrc already exists in current directory.`);
      process.exit(1);
    }
    fs.writeFileSync(target, generateStarterConfig());
    console.log("Created .codegoatrc with default settings.");
    console.log("Edit it to customize your codegoat configuration.");
  });

program.parse();
