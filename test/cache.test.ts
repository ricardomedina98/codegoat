import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cacheKey, getCached, setCached, clearCache, getCacheStatus, ensureCacheDir } from "../src/cache/cache.js";

describe("cacheKey", () => {
  it("produces consistent hex keys", () => {
    const k1 = cacheKey("const x = 1;", "app.ts", { provider: "openai" }, "0.4.0");
    const k2 = cacheKey("const x = 1;", "app.ts", { provider: "openai" }, "0.4.0");
    assert.equal(k1, k2);
    assert.equal(k1.length, 16);
  });

  it("changes when content changes", () => {
    const k1 = cacheKey("const x = 1;", "app.ts", {}, "0.4.0");
    const k2 = cacheKey("const x = 2;", "app.ts", {}, "0.4.0");
    assert.notEqual(k1, k2);
  });

  it("changes when config changes", () => {
    const k1 = cacheKey("x", "a.ts", { provider: "openai" }, "0.4.0");
    const k2 = cacheKey("x", "a.ts", { provider: "anthropic" }, "0.4.0");
    assert.notEqual(k1, k2);
  });

  it("changes when rules change", () => {
    const k1 = cacheKey("x", "a.ts", { rules: ["rule1"] }, "0.4.0");
    const k2 = cacheKey("x", "a.ts", { rules: ["rule2"] }, "0.4.0");
    assert.notEqual(k1, k2);
  });

  it("changes when version changes", () => {
    const k1 = cacheKey("x", "a.ts", {}, "0.4.0");
    const k2 = cacheKey("x", "a.ts", {}, "0.5.0");
    assert.notEqual(k1, k2);
  });
});

describe("getCached / setCached", () => {
  let tmpDir: string;
  afterEach(() => { if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it("returns null on cache miss", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-cache-"));
    assert.equal(getCached(tmpDir, "nonexistent"), null);
  });

  it("stores and retrieves review", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-cache-"));
    setCached(tmpDir, "testkey", "# Review\nLooks good!", "0.4.0");
    const result = getCached(tmpDir, "testkey");
    assert.equal(result, "# Review\nLooks good!");
  });

  it("returns null for corrupt cache file", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-cache-"));
    ensureCacheDir(tmpDir);
    fs.writeFileSync(path.join(tmpDir, ".codegoat-cache", "bad.json"), "not json!!!");
    assert.equal(getCached(tmpDir, "bad"), null);
  });
});

describe("clearCache", () => {
  let tmpDir: string;
  afterEach(() => { if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it("clears all entries and returns count", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-cache-"));
    setCached(tmpDir, "k1", "review1", "0.4.0");
    setCached(tmpDir, "k2", "review2", "0.4.0");
    const count = clearCache(tmpDir);
    assert.equal(count, 2);
    assert.equal(getCached(tmpDir, "k1"), null);
  });

  it("returns 0 when no cache exists", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-cache-"));
    assert.equal(clearCache(tmpDir), 0);
  });
});

describe("getCacheStatus", () => {
  let tmpDir: string;
  afterEach(() => { if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it("reports empty cache", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-cache-"));
    const status = getCacheStatus(tmpDir);
    assert.equal(status.entries, 0);
    assert.equal(status.totalBytes, 0);
    assert.equal(status.oldestAge, null);
  });

  it("reports populated cache", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-cache-"));
    setCached(tmpDir, "k1", "review content here", "0.4.0");
    const status = getCacheStatus(tmpDir);
    assert.equal(status.entries, 1);
    assert.ok(status.totalBytes > 0);
    assert.ok(status.maxBytes === 10 * 1024 * 1024);
    assert.ok(typeof status.oldestAge === "number");
  });
});

describe("auto .gitignore", () => {
  let tmpDir: string;
  afterEach(() => { if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it("adds .codegoat-cache/ to .gitignore", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-cache-"));
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), "node_modules/\n");
    setCached(tmpDir, "k1", "review", "0.4.0");
    const gi = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
    assert.ok(gi.includes(".codegoat-cache/"));
  });

  it("does not duplicate .codegoat-cache/ entry", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-cache-"));
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), ".codegoat-cache/\n");
    setCached(tmpDir, "k1", "review", "0.4.0");
    const gi = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
    const matches = gi.match(/\.codegoat-cache\//g);
    assert.equal(matches?.length, 1);
  });
});
