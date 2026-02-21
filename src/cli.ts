#!/usr/bin/env node

import { Command } from "commander";

const program = new Command();

program
  .name("codegoat")
  .description("AI-powered code review and documentation generator")
  .version("0.1.0");

program
  .command("review")
  .description("Review code in the given path")
  .argument("<path>", "path to review")
  .action((path: string) => {
    console.log(`codegoat review: not implemented yet (path: ${path})`);
    process.exit(0);
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
