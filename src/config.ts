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

const REPO_ROOT_MARKERS = [".git", ".hg", ".svn"];
const PACKAGE_MARKERS = ["package.json", "go.mod", "Cargo.toml", "Gemfile", "pom.xml", "build.gradle", "pyproject.toml", "setup.py"];

/**
 * Find the repo root by walking up from startDir looking for .git etc.
 */
function findRepoRoot(startDir: string): string {
  let dir = path.resolve(startDir);
  while (true) {
    for (const marker of REPO_ROOT_MARKERS) {
      if (fs.existsSync(path.join(dir, marker))) return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return startDir; // reached filesystem root
    dir = parent;
  }
}

/**
 * Walk up from targetDir to repoRoot, collecting all .codegoatrc files
 * (deepest first). Returns array from root → target (for merge ordering).
 */
export function walkUpConfigs(targetDir: string, repoRoot?: string): CodegoatConfig[] {
  const resolved = path.resolve(targetDir);
  const root = repoRoot ? path.resolve(repoRoot) : findRepoRoot(resolved);
  const configs: Array<{ dir: string; config: CodegoatConfig }> = [];

  let dir = resolved;
  while (true) {
    const cfg = loadJsonFile(path.join(dir, CONFIG_FILENAME));
    if (cfg) configs.push({ dir, config: cfg });
    if (dir === root) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Reverse: root configs first, child configs last (child wins on merge)
  configs.reverse();
  return configs.map(c => c.config);
}

/**
 * Deep merge configs: scalars = child wins, rules = concatenate.
 */
export function mergeConfigs(configs: CodegoatConfig[]): CodegoatConfig {
  const merged: CodegoatConfig = {};
  const allRules: string[] = [];

  for (const cfg of configs) {
    if (cfg.provider !== undefined) merged.provider = cfg.provider;
    if (cfg.model !== undefined) merged.model = cfg.model;
    if (cfg.budget !== undefined) merged.budget = cfg.budget;
    if (cfg.format !== undefined) merged.format = cfg.format;
    if (cfg.ollamaUrl !== undefined) merged.ollamaUrl = cfg.ollamaUrl;
    if (cfg.rules) allRules.push(...cfg.rules);
  }

  if (allRules.length > 0) merged.rules = allRules;
  return merged;
}

/**
 * Detect if a directory is a package boundary.
 */
export function isPackageBoundary(dirPath: string): boolean {
  return PACKAGE_MARKERS.some(m => fs.existsSync(path.join(dirPath, m))) ||
    fs.existsSync(path.join(dirPath, CONFIG_FILENAME));
}

/**
 * Detect package boundaries under a root directory (1 level deep for perf).
 */
export function detectPackages(rootDir: string): string[] {
  const packages: string[] = [];
  try {
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const fullPath = path.join(rootDir, entry.name);
      if (isPackageBoundary(fullPath)) {
        packages.push(entry.name);
      }
      // Check one more level (e.g., packages/api)
      try {
        const subEntries = fs.readdirSync(fullPath, { withFileTypes: true });
        for (const sub of subEntries) {
          if (!sub.isDirectory() || sub.name.startsWith(".")) continue;
          const subPath = path.join(fullPath, sub.name);
          if (isPackageBoundary(subPath)) {
            packages.push(path.join(entry.name, sub.name));
          }
        }
      } catch { /* skip unreadable */ }
    }
  } catch { /* skip */ }
  return packages;
}

export function loadConfig(cwd?: string): CodegoatConfig {
  const workDir = cwd ?? process.cwd();

  // 1. Home dir config (lowest priority)
  const homeConfig = loadJsonFile(path.join(os.homedir(), CONFIG_FILENAME));

  // 2. Walk-up configs from target dir to repo root
  const walkUpList = walkUpConfigs(workDir);

  // Merge: home < walk-up (root → child)
  const allConfigs = homeConfig ? [homeConfig, ...walkUpList] : walkUpList;
  const merged = mergeConfigs(allConfigs);

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
