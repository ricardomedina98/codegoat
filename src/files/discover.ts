import fs from "node:fs";
import path from "node:path";
import ignore, { type Ignore } from "ignore";

export interface DiscoveredFile {
  path: string; // relative to root
  content: string;
  sizeBytes: number;
}

const SUPPORTED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
]);

const SKIP_DIRS = new Set(["node_modules", "dist", ".git"]);

const LOCKFILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
]);

const MAX_FILE_SIZE = 50 * 1024; // 50 KB

function isBinary(buffer: Buffer): boolean {
  const bytesToCheck = Math.min(buffer.length, 512);
  for (let i = 0; i < bytesToCheck; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

function loadGitignore(dirPath: string, parent: Ignore): Ignore {
  const ig = ignore().add(parent);
  const gitignorePath = path.join(dirPath, ".gitignore");
  try {
    const content = fs.readFileSync(gitignorePath, "utf-8");
    ig.add(content);
  } catch {
    // No .gitignore in this directory
  }
  return ig;
}

async function walk(
  dirPath: string,
  rootPath: string,
  ig: Ignore,
  results: DiscoveredFile[]
): Promise<void> {
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(rootPath, fullPath);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      if (ig.ignores(relativePath + "/")) continue;

      const childIg = loadGitignore(fullPath, ig);
      await walk(fullPath, rootPath, childIg, results);
    } else if (entry.isFile()) {
      if (LOCKFILES.has(entry.name)) continue;
      if (!SUPPORTED_EXTENSIONS.has(path.extname(entry.name))) continue;
      if (ig.ignores(relativePath)) continue;

      const stat = await fs.promises.stat(fullPath);
      if (stat.size > MAX_FILE_SIZE) continue;

      const buffer = await fs.promises.readFile(fullPath);
      if (isBinary(buffer)) continue;

      results.push({
        path: relativePath,
        content: buffer.toString("utf-8"),
        sizeBytes: stat.size,
      });
    }
  }
}

function loadCodegoatIgnore(rootPath: string, parent: Ignore): Ignore {
  const ig = ignore().add(parent);
  const ignorePath = path.join(rootPath, ".codegoatignore");
  try {
    const content = fs.readFileSync(ignorePath, "utf-8");
    ig.add(content);
  } catch {
    // No .codegoatignore
  }
  return ig;
}

export interface DiscoverOptions {
  noIgnore?: boolean;
}

export async function discoverFiles(
  rootPath: string,
  options?: DiscoverOptions
): Promise<DiscoveredFile[]> {
  const resolvedRoot = path.resolve(rootPath);
  let ig = loadGitignore(resolvedRoot, ignore());
  if (!options?.noIgnore) {
    ig = loadCodegoatIgnore(resolvedRoot, ig);
  }
  const results: DiscoveredFile[] = [];
  await walk(resolvedRoot, resolvedRoot, ig, results);
  return results;
}
