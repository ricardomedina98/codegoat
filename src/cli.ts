#!/usr/bin/env node

import fs from "node:fs";
import { Command } from "commander";
import { runReview } from "./commands/review.js";
import { runWatch } from "./commands/watch.js";
import { runFix } from "./commands/fix.js";
import { runTest } from "./commands/test.js";
import { captureOutput } from "./output/writer.js";
import { clearCache, getCacheStatus } from "./cache/cache.js";
import { runDocs } from "./commands/docs.js";
import { loadConfig, applyConfig, generateStarterConfig } from "./config.js";
import { setVerbose, setQuiet, error, info, debug, classifyError, EXIT_CONFIG_ERROR } from "./output/logger.js";

const config = loadConfig();

const program = new Command();

program
  .name("codegoat")
  .description("AI-powered code review and documentation generator")
  .version("1.1.0")
  .option("-v, --verbose", "enable debug logging")
  .option("-q, --quiet", "suppress all output except findings and errors")
  .hook("preAction", () => {
    const opts = program.opts();
    if (opts.verbose) setVerbose(true);
    if (opts.quiet) setQuiet(true);
  });

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
  .option("--no-cache", "skip review cache")
  .option("--comment-mode <mode>", "PR comment mode: inline, summary, or log (default: inline in PR context)")
  .option("--comment-severity <level>", "minimum severity for inline PR comments (default: warning)")
  .option("--ci-platform <platform>", "CI platform override: github, gitlab (auto-detected by default)")
  .option("--no-color", "disable color output")
  .option("-o, --output <path>", "write output to file instead of stdout")
  .action(async (path: string, opts: { provider?: string; model?: string; budget?: string; format?: string; diff?: boolean | string; severity?: string; failOn?: string; ignore?: boolean; watch?: boolean; cache?: boolean; commentMode?: string; commentSeverity?: string; ciPlatform?: string; color?: boolean; output?: string }) => {
    applyConfig(opts, config);
    const capture = captureOutput(opts.output);
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
      noCache: opts.cache === false,
      noColor: opts.color === false,
      commentMode: (opts.commentMode as any) ?? undefined,
      commentSeverity: opts.commentSeverity,
      ciPlatform: opts.ciPlatform,
      rules,
    });
    capture.flush();
  });

program
  .command("docs")
  .description("Generate documentation for the given path")
  .argument("<path>", "path to document")
  .option("-p, --provider <name>", "LLM provider (default: openai)")
  .option("-m, --model <name>", "model name")
  .option("-b, --budget <tokens>", "max token budget")
  .option("-l, --level <level>", "doc level: project, file, or function", "project")
  .option("-o, --output <path>", "write output to file instead of stdout")
  .action(async (path: string, opts: { provider?: string; model?: string; budget?: string; level?: string; output?: string }) => {
    applyConfig(opts, config);
    const capture = captureOutput(opts.output);
    const level = (["project", "file", "function"].includes(opts.level ?? "")
      ? opts.level
      : "project") as "project" | "file" | "function";
    await runDocs(path, {
      provider: opts.provider,
      model: opts.model,
      budget: opts.budget ? parseInt(opts.budget, 10) : undefined,
      level,
    });
    capture.flush();
  });

program
  .command("fix")
  .description("Review and auto-fix issues in the given path")
  .argument("<path>", "path to fix")
  .option("-p, --provider <name>", "LLM provider")
  .option("-m, --model <name>", "model name")
  .option("-b, --budget <tokens>", "max token budget")
  .option("-s, --severity <level>", "minimum severity to fix", "warning")
  .option("--apply", "auto-apply all fixes without prompting")
  .option("--dry-run", "preview fixes without writing")
  .option("-f, --format <type>", "output format: markdown or json")
  .option("--no-ignore", "skip .codegoatignore")
  .option("-o, --output <path>", "write output to file instead of stdout")
  .action(async (path: string, opts: { provider?: string; model?: string; budget?: string; severity?: string; apply?: boolean; dryRun?: boolean; format?: string; ignore?: boolean; output?: string }) => {
    applyConfig(opts, config);
    const capture = captureOutput(opts.output);
    const rules = config.rules?.filter((r: string) => !r.startsWith("//"));
    await runFix(path, {
      provider: opts.provider,
      model: opts.model,
      budget: opts.budget ? parseInt(opts.budget, 10) : undefined,
      severity: opts.severity,
      apply: opts.apply,
      dryRun: opts.dryRun,
      format: (opts.format === "json" ? "json" : "markdown") as "markdown" | "json",
      noIgnore: opts.ignore === false,
      rules,
    });
    capture.flush();
  });

program
  .command("test")
  .description("Generate unit tests for source files using AI")
  .argument("<path>", "path to generate tests for")
  .option("-p, --provider <name>", "LLM provider")
  .option("-m, --model <name>", "model name")
  .option("-b, --budget <tokens>", "max token budget")
  .option("--framework <name>", "test framework override (jest, vitest, mocha, node, pytest, rspec, junit5, go-test, cargo-test)")
  .option("--dry-run", "preview generated tests without writing")
  .option("-f, --format <type>", "output format: markdown or json")
  .option("--no-ignore", "skip .codegoatignore")
  .option("-o, --output <path>", "write output to file instead of stdout")
  .action(async (path: string, opts: { provider?: string; model?: string; budget?: string; framework?: string; dryRun?: boolean; format?: string; ignore?: boolean; output?: string }) => {
    applyConfig(opts, config);
    const capture = captureOutput(opts.output);
    const rules = config.rules?.filter((r: string) => !r.startsWith("//"));
    await runTest(path, {
      provider: opts.provider,
      model: opts.model,
      budget: opts.budget ? parseInt(opts.budget, 10) : undefined,
      framework: opts.framework,
      dryRun: opts.dryRun,
      format: (opts.format === "json" ? "json" : "markdown") as "markdown" | "json",
      noIgnore: opts.ignore === false,
      rules,
    });
    capture.flush();
  });

program
  .command("lsp")
  .description("Start the Language Server Protocol server (stdio transport)")
  .action(async () => {
    const { startServer } = await import("./lsp/server.js");
    startServer();
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

const cacheCmd = program
  .command("cache")
  .description("Manage the review cache");

cacheCmd
  .command("status")
  .description("Show cache statistics")
  .action(() => {
    const status = getCacheStatus(process.cwd());
    console.log(`Cache entries: ${status.entries}`);
    console.log(`Total size: ${(status.totalBytes / 1024).toFixed(1)} KB / ${(status.maxBytes / 1024 / 1024).toFixed(0)} MB`);
    if (status.oldestAge !== null) {
      const mins = Math.round(status.oldestAge / 60000);
      console.log(`Oldest entry: ${mins < 60 ? `${mins}m` : `${(mins / 60).toFixed(1)}h`} ago`);
    }
  });

cacheCmd
  .command("clear")
  .description("Clear all cached reviews")
  .action(() => {
    const count = clearCache(process.cwd());
    console.log(`Cleared ${count} cached review${count !== 1 ? "s" : ""}.`);
  });

program.parse();
