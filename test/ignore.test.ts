import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { discoverFiles } from "../src/files/discover.js";

describe(".codegoatignore", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("excludes files matched by .codegoatignore", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-ign-"));
    fs.writeFileSync(path.join(tmpDir, "app.ts"), "const x = 1;");
    fs.writeFileSync(path.join(tmpDir, "generated.ts"), "// auto-generated");
    fs.writeFileSync(path.join(tmpDir, ".codegoatignore"), "generated.ts\n");

    const files = await discoverFiles(tmpDir);
    assert.equal(files.length, 1);
    assert.equal(files[0].path, "app.ts");
  });

  it("supports glob patterns", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-ign-"));
    fs.writeFileSync(path.join(tmpDir, "app.ts"), "x");
    fs.writeFileSync(path.join(tmpDir, "app.test.ts"), "test");
    fs.writeFileSync(path.join(tmpDir, "util.test.ts"), "test");
    fs.writeFileSync(path.join(tmpDir, ".codegoatignore"), "*.test.ts\n");

    const files = await discoverFiles(tmpDir);
    assert.equal(files.length, 1);
    assert.equal(files[0].path, "app.ts");
  });

  it("--no-ignore skips .codegoatignore", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-ign-"));
    fs.writeFileSync(path.join(tmpDir, "app.ts"), "x");
    fs.writeFileSync(path.join(tmpDir, "generated.ts"), "y");
    fs.writeFileSync(path.join(tmpDir, ".codegoatignore"), "generated.ts\n");

    const files = await discoverFiles(tmpDir, { noIgnore: true });
    assert.equal(files.length, 2);
  });

  it("works when no .codegoatignore exists", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-ign-"));
    fs.writeFileSync(path.join(tmpDir, "app.ts"), "x");

    const files = await discoverFiles(tmpDir);
    assert.equal(files.length, 1);
  });
});
