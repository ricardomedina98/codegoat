import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const CACHE_DIR = ".codegoat-cache";
const MAX_CACHE_BYTES = 10 * 1024 * 1024; // 10MB
const CACHE_VERSION = 1;

export interface CacheEntry {
  version: number;
  codegoatVersion: string;
  key: string;
  review: string;
  createdAt: number;
  accessedAt: number;
  sizeBytes: number;
}

export interface CacheConfig {
  provider?: string;
  model?: string;
  rules?: string[];
}

export function cacheKey(
  fileContent: string,
  filePath: string,
  config: CacheConfig,
  codegoatVersion: string
): string {
  const hash = crypto.createHash("sha256");
  hash.update(filePath);
  hash.update(fileContent);
  hash.update(JSON.stringify({ provider: config.provider, model: config.model, rules: config.rules ?? [] }));
  hash.update(codegoatVersion);
  return hash.digest("hex").slice(0, 16);
}

function getCacheDir(rootPath: string): string {
  return path.join(rootPath, CACHE_DIR);
}

function entryPath(rootPath: string, key: string): string {
  return path.join(getCacheDir(rootPath), `${key}.json`);
}

export function ensureCacheDir(rootPath: string): void {
  const dir = getCacheDir(rootPath);
  fs.mkdirSync(dir, { recursive: true });

  // Auto-add to .gitignore
  const gitignorePath = path.join(rootPath, ".gitignore");
  try {
    const content = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, "utf-8") : "";
    if (!content.includes(CACHE_DIR)) {
      const newline = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
      fs.appendFileSync(gitignorePath, `${newline}${CACHE_DIR}/\n`);
    }
  } catch { /* best effort */ }
}

export function getCached(rootPath: string, key: string): string | null {
  try {
    const raw = fs.readFileSync(entryPath(rootPath, key), "utf-8");
    const entry: CacheEntry = JSON.parse(raw);
    if (entry.version !== CACHE_VERSION) return null;
    // Update access time
    entry.accessedAt = Date.now();
    try { fs.writeFileSync(entryPath(rootPath, key), JSON.stringify(entry)); } catch { /* best effort */ }
    return entry.review;
  } catch {
    return null;
  }
}

export function setCached(
  rootPath: string,
  key: string,
  review: string,
  codegoatVersion: string
): void {
  ensureCacheDir(rootPath);
  const entry: CacheEntry = {
    version: CACHE_VERSION,
    codegoatVersion,
    key,
    review,
    createdAt: Date.now(),
    accessedAt: Date.now(),
    sizeBytes: Buffer.byteLength(review),
  };
  const data = JSON.stringify(entry);
  fs.writeFileSync(entryPath(rootPath, key), data);
  evictIfNeeded(rootPath);
}

function evictIfNeeded(rootPath: string): void {
  const dir = getCacheDir(rootPath);
  let entries: Array<{ name: string; accessedAt: number; size: number }> = [];
  let totalSize = 0;

  try {
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".json")) continue;
      const fp = path.join(dir, name);
      try {
        const raw = fs.readFileSync(fp, "utf-8");
        const entry: CacheEntry = JSON.parse(raw);
        const size = Buffer.byteLength(raw);
        entries.push({ name, accessedAt: entry.accessedAt ?? 0, size });
        totalSize += size;
      } catch {
        // Corrupt entry — remove
        try { fs.unlinkSync(fp); } catch { /* ignore */ }
      }
    }
  } catch { return; }

  if (totalSize <= MAX_CACHE_BYTES) return;

  // LRU eviction: sort oldest-accessed first
  entries.sort((a, b) => a.accessedAt - b.accessedAt);
  while (totalSize > MAX_CACHE_BYTES && entries.length > 0) {
    const oldest = entries.shift()!;
    try { fs.unlinkSync(path.join(dir, oldest.name)); } catch { /* ignore */ }
    totalSize -= oldest.size;
  }
}

export function clearCache(rootPath: string): number {
  const dir = getCacheDir(rootPath);
  let count = 0;
  try {
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".json")) continue;
      fs.unlinkSync(path.join(dir, name));
      count++;
    }
  } catch { /* dir doesn't exist */ }
  return count;
}

export interface CacheStatus {
  entries: number;
  totalBytes: number;
  maxBytes: number;
  oldestAge: number | null; // ms
  newestAge: number | null;
}

export function getCacheStatus(rootPath: string): CacheStatus {
  const dir = getCacheDir(rootPath);
  const now = Date.now();
  let entries = 0;
  let totalBytes = 0;
  let oldest = Infinity;
  let newest = 0;

  try {
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".json")) continue;
      try {
        const fp = path.join(dir, name);
        const raw = fs.readFileSync(fp, "utf-8");
        const entry: CacheEntry = JSON.parse(raw);
        entries++;
        totalBytes += Buffer.byteLength(raw);
        if (entry.createdAt < oldest) oldest = entry.createdAt;
        if (entry.createdAt > newest) newest = entry.createdAt;
      } catch { /* skip corrupt */ }
    }
  } catch { /* dir doesn't exist */ }

  return {
    entries,
    totalBytes,
    maxBytes: MAX_CACHE_BYTES,
    oldestAge: entries > 0 ? now - oldest : null,
    newestAge: entries > 0 ? now - newest : null,
  };
}
