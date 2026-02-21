import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { discoverFiles } from "../src/files/discover.js";

describe("Python and Go language support", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("discovers .py files", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-lang-"));
    fs.writeFileSync(path.join(tmpDir, "main.py"), 'def hello():\n    print("hi")\n');
    fs.writeFileSync(path.join(tmpDir, "utils.py"), "def add(a, b):\n    return a + b\n");

    const files = await discoverFiles(tmpDir);
    assert.equal(files.length, 2);
    const paths = files.map((f) => f.path).sort();
    assert.deepEqual(paths, ["main.py", "utils.py"]);
  });

  it("discovers .go files", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-lang-"));
    fs.writeFileSync(
      path.join(tmpDir, "main.go"),
      'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("hello")\n}\n'
    );

    const files = await discoverFiles(tmpDir);
    assert.equal(files.length, 1);
    assert.equal(files[0].path, "main.go");
  });

  it("discovers mixed JS/TS/Python/Go files", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-lang-"));
    fs.writeFileSync(path.join(tmpDir, "app.ts"), "const x = 1;");
    fs.writeFileSync(path.join(tmpDir, "main.py"), "x = 1");
    fs.writeFileSync(path.join(tmpDir, "main.go"), "package main");
    fs.writeFileSync(path.join(tmpDir, "data.json"), "{}"); // should be skipped

    const files = await discoverFiles(tmpDir);
    assert.equal(files.length, 3);
    const exts = files.map((f) => path.extname(f.path)).sort();
    assert.deepEqual(exts, [".go", ".py", ".ts"]);
  });

  it("skips Python __pycache__ via .gitignore", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-lang-"));
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), "__pycache__/\n");
    fs.writeFileSync(path.join(tmpDir, "app.py"), "x = 1");
    fs.mkdirSync(path.join(tmpDir, "__pycache__"));
    fs.writeFileSync(path.join(tmpDir, "__pycache__", "app.cpython-311.pyc"), "binary");

    const files = await discoverFiles(tmpDir);
    assert.equal(files.length, 1);
    assert.equal(files[0].path, "app.py");
  });
});
