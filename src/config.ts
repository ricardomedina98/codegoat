import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface CodegoatConfig {
  provider?: string;
  model?: string;
  budget?: number;
  format?: "markdown" | "json";
  ollamaUrl?: string;
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

export const STARTER_CONFIG: CodegoatConfig = {
  provider: "openai",
  model: "gpt-4o-mini",
  budget: 100000,
};

export function generateStarterConfig(): string {
  return JSON.stringify(STARTER_CONFIG, null, 2) + "\n";
}
