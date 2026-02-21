import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { discoverFiles } from "../src/files/discover.js";

describe("language support", () => {
  let tmpDir: string;
  afterEach(() => { if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it("discovers Ruby .rb files", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-lang-"));
    fs.writeFileSync(path.join(tmpDir, "app.rb"), 'class App\n  def hello\n    puts "hello"\n  end\nend\n');
    const files = await discoverFiles(tmpDir);
    assert.equal(files.length, 1);
    assert.equal(files[0].path, "app.rb");
  });

  it("discovers Java .java files", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-lang-"));
    fs.writeFileSync(path.join(tmpDir, "Main.java"), 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("hello");\n  }\n}\n');
    const files = await discoverFiles(tmpDir);
    assert.equal(files.length, 1);
    assert.equal(files[0].path, "Main.java");
  });

  it("discovers Rust .rs files", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-lang-"));
    fs.writeFileSync(path.join(tmpDir, "main.rs"), 'fn main() {\n    println!("hello");\n}\n');
    const files = await discoverFiles(tmpDir);
    assert.equal(files.length, 1);
    assert.equal(files[0].path, "main.rs");
  });

  it("discovers mixed language projects", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-lang-"));
    fs.writeFileSync(path.join(tmpDir, "app.ts"), "const x = 1;");
    fs.writeFileSync(path.join(tmpDir, "app.py"), "x = 1");
    fs.writeFileSync(path.join(tmpDir, "app.go"), "package main");
    fs.writeFileSync(path.join(tmpDir, "app.rb"), "x = 1");
    fs.writeFileSync(path.join(tmpDir, "App.java"), "class App {}");
    fs.writeFileSync(path.join(tmpDir, "main.rs"), "fn main() {}");
    fs.writeFileSync(path.join(tmpDir, "data.csv"), "a,b,c"); // should be ignored
    const files = await discoverFiles(tmpDir);
    assert.equal(files.length, 6);
  });
});
