import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface CodegoatConfig {
  provider?: string;
  model?: string;
  budget?: number;
  format?: "markdown" | "json";
  ollamaUrl?: string;
  rules?: string[];
}

const CONFIG_FILENAME = ".codegoatrc";

function loadJsonFile(filePath: string): CodegoatConfig | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as CodegoatConfig;
  } catch {
    return null;
  }
}

export function loadConfig(cwd?: string): CodegoatConfig {
  const workDir = cwd ?? process.cwd();

  // 1. Home dir config (lowest priority)
  const homeConfig = loadJsonFile(path.join(os.homedir(), CONFIG_FILENAME));

  // 2. CWD config (overrides home)
  const cwdConfig = loadJsonFile(path.join(workDir, CONFIG_FILENAME));

  // Merge: home < cwd
  const merged: CodegoatConfig = {
    ...homeConfig,
    ...cwdConfig,
  };

  // Remove undefined keys
  for (const key of Object.keys(merged) as (keyof CodegoatConfig)[]) {
    if (merged[key] === undefined) delete merged[key];
  }

  return merged;
}

export function applyConfig(
  cliOpts: Record<string, unknown>,
  config: CodegoatConfig
): void {
  // Apply config values to env vars where CLI flags aren't set
  // Precedence: CLI flags > env vars > config file

  if (config.provider && !cliOpts.provider && !process.env.CODEGOAT_PROVIDER) {
    process.env.CODEGOAT_PROVIDER = config.provider;
  }

  if (config.model && !cliOpts.model && !process.env.CODEGOAT_MODEL) {
    process.env.CODEGOAT_MODEL = config.model;
  }

  if (config.budget && !cliOpts.budget && !process.env.CODEGOAT_MAX_TOKENS) {
    process.env.CODEGOAT_MAX_TOKENS = String(config.budget);
  }

  if (config.ollamaUrl && !process.env.CODEGOAT_OLLAMA_URL) {
    process.env.CODEGOAT_OLLAMA_URL = config.ollamaUrl;
  }
}

const MAX_RULES = 20;
const MAX_RULE_LENGTH = 200;

export function validateRules(rules: string[]): string[] {
  const validated: string[] = [];
  for (const rule of rules.slice(0, MAX_RULES)) {
    if (typeof rule === "string" && rule.trim()) {
      const trimmed = rule.trim().slice(0, MAX_RULE_LENGTH);
      validated.push(trimmed);
    }
  }
  if (rules.length > MAX_RULES) {
    console.error(`Warning: .codegoatrc has ${rules.length} rules, max is ${MAX_RULES}. Extra rules ignored.`);
  }
  return validated;
}

export const STARTER_CONFIG = {
  provider: "openai",
  model: "gpt-4o-mini",
  budget: 100000,
  rules: [
    "// Add project-specific review rules here (remove // prefix to enable)",
    "// Example: Always check for proper error handling in async functions",
    "// Example: Ensure all public APIs have input validation",
  ],
};

export function generateStarterConfig(): string {
  // Output clean JSON but with commented rules as hints
  const config = {
    provider: STARTER_CONFIG.provider,
    model: STARTER_CONFIG.model,
    budget: STARTER_CONFIG.budget,
    rules: [],
  };
  const json = JSON.stringify(config, null, 2);
  // Add comment hints after the empty rules array
  return json.replace(
    '"rules": []',
    `"rules": [\n    "Always check for proper error handling in async functions",\n    "Ensure all public APIs have input validation"\n  ]`
  ) + "\n";
}
