import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { discoverFiles } from "../src/files/discover.js";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "discover-test-"));
}

function writeFile(root: string, relPath: string, content: string): void {
  const fullPath = path.join(root, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

describe("discoverFiles", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = makeTempDir();

    // Supported files
    writeFile(tmpDir, "index.ts", 'console.log("hello");');
    writeFile(tmpDir, "app.tsx", "export default function App() {}");
    writeFile(tmpDir, "lib/utils.js", "module.exports = {};");
    writeFile(tmpDir, "lib/helpers.mjs", "export const x = 1;");
    writeFile(tmpDir, "config.cjs", "module.exports = {};");
    writeFile(tmpDir, "deep/nested/component.jsx", "function C() {}");

    // Should be skipped: unsupported extensions
    writeFile(tmpDir, "README.md", "# Readme");
    writeFile(tmpDir, "data.json", "{}");
    writeFile(tmpDir, "styles.css", "body {}");

    // Should be skipped: lockfiles
    writeFile(tmpDir, "package-lock.json", "{}");
    writeFile(tmpDir, "yarn.lock", "");
    writeFile(tmpDir, "pnpm-lock.yaml", "");

    // Should be skipped: node_modules
    writeFile(tmpDir, "node_modules/pkg/index.js", 'require("x")');

    // Should be skipped: dist
    writeFile(tmpDir, "dist/bundle.js", "var a = 1;");

    // Should be skipped: .git
    writeFile(tmpDir, ".git/config", "[core]");

    // Should be skipped: file > 50KB
    writeFile(tmpDir, "huge.ts", "x".repeat(51 * 1024));

    // Should be skipped: binary file (contains null bytes)
    const binaryBuf = Buffer.alloc(100);
    binaryBuf[50] = 0; // null byte
    binaryBuf.write("notall", 0);
    fs.writeFileSync(path.join(tmpDir, "binary.ts"), binaryBuf);

    // .gitignore that ignores a specific file
    writeFile(tmpDir, ".gitignore", "config.cjs\n");
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("discovers supported source files", async () => {
    const files = await discoverFiles(tmpDir);
    const paths = files.map((f) => f.path).sort();

    assert.ok(paths.includes("index.ts"));
    assert.ok(paths.includes("app.tsx"));
    assert.ok(paths.includes("lib/utils.js"));
    assert.ok(paths.includes("lib/helpers.mjs"));
    assert.ok(paths.includes("deep/nested/component.jsx"));
  });

  it("skips unsupported extensions", async () => {
    const files = await discoverFiles(tmpDir);
    const paths = files.map((f) => f.path);

    assert.ok(!paths.includes("README.md"));
    assert.ok(!paths.includes("data.json"));
    assert.ok(!paths.includes("styles.css"));
  });

  it("skips lockfiles", async () => {
    const files = await discoverFiles(tmpDir);
    const paths = files.map((f) => f.path);

    assert.ok(!paths.includes("package-lock.json"));
    assert.ok(!paths.includes("yarn.lock"));
    assert.ok(!paths.includes("pnpm-lock.yaml"));
  });

  it("skips node_modules, dist, and .git directories", async () => {
    const files = await discoverFiles(tmpDir);
    const paths = files.map((f) => f.path);

    for (const p of paths) {
      assert.ok(!p.startsWith("node_modules/"), `should skip ${p}`);
      assert.ok(!p.startsWith("dist/"), `should skip ${p}`);
      assert.ok(!p.startsWith(".git/"), `should skip ${p}`);
    }
  });

  it("skips files larger than 50KB", async () => {
    const files = await discoverFiles(tmpDir);
    const paths = files.map((f) => f.path);

    assert.ok(!paths.includes("huge.ts"));
  });

  it("skips binary files", async () => {
    const files = await discoverFiles(tmpDir);
    const paths = files.map((f) => f.path);

    assert.ok(!paths.includes("binary.ts"));
  });

  it("respects .gitignore rules", async () => {
    const files = await discoverFiles(tmpDir);
    const paths = files.map((f) => f.path);

    assert.ok(!paths.includes("config.cjs"));
  });

  it("returns correct content and sizeBytes", async () => {
    const files = await discoverFiles(tmpDir);
    const indexFile = files.find((f) => f.path === "index.ts");

    assert.ok(indexFile);
    assert.equal(indexFile.content, 'console.log("hello");');
    assert.equal(indexFile.sizeBytes, Buffer.byteLength('console.log("hello");'));
  });

  it("returns empty array for empty directory", async () => {
    const emptyDir = makeTempDir();
    try {
      const files = await discoverFiles(emptyDir);
      assert.deepEqual(files, []);
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});
