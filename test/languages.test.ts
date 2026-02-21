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

  it("discovers C .c and .h files", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-lang-"));
    fs.writeFileSync(path.join(tmpDir, "main.c"), '#include <stdio.h>\nint main() { return 0; }\n');
    fs.writeFileSync(path.join(tmpDir, "utils.h"), '#ifndef UTILS_H\n#define UTILS_H\nvoid foo();\n#endif\n');
    const files = await discoverFiles(tmpDir);
    assert.equal(files.length, 2);
  });

  it("discovers C++ .cpp, .hpp, and .cc files", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-lang-"));
    fs.writeFileSync(path.join(tmpDir, "main.cpp"), '#include <iostream>\nint main() { return 0; }\n');
    fs.writeFileSync(path.join(tmpDir, "utils.hpp"), '#pragma once\nvoid foo();\n');
    fs.writeFileSync(path.join(tmpDir, "lib.cc"), 'void bar() {}\n');
    const files = await discoverFiles(tmpDir);
    assert.equal(files.length, 3);
  });

  it("discovers PHP .php files", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-lang-"));
    fs.writeFileSync(path.join(tmpDir, "index.php"), '<?php\necho "hello";\n');
    const files = await discoverFiles(tmpDir);
    assert.equal(files.length, 1);
    assert.equal(files[0].path, "index.php");
  });

  it("discovers Kotlin .kt files", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-lang-"));
    fs.writeFileSync(path.join(tmpDir, "Main.kt"), 'fun main() { println("hello") }\n');
    const files = await discoverFiles(tmpDir);
    assert.equal(files.length, 1);
    assert.equal(files[0].path, "Main.kt");
  });

  it("discovers Swift .swift files", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-lang-"));
    fs.writeFileSync(path.join(tmpDir, "main.swift"), 'print("hello")\n');
    const files = await discoverFiles(tmpDir);
    assert.equal(files.length, 1);
    assert.equal(files[0].path, "main.swift");
  });

  it("discovers Scala .scala files", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-lang-"));
    fs.writeFileSync(path.join(tmpDir, "Main.scala"), 'object Main extends App { println("hello") }\n');
    const files = await discoverFiles(tmpDir);
    assert.equal(files.length, 1);
    assert.equal(files[0].path, "Main.scala");
  });

  it("discovers mixed language projects", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-lang-"));
    fs.writeFileSync(path.join(tmpDir, "app.ts"), "const x = 1;");
    fs.writeFileSync(path.join(tmpDir, "app.py"), "x = 1");
    fs.writeFileSync(path.join(tmpDir, "app.go"), "package main");
    fs.writeFileSync(path.join(tmpDir, "app.rb"), "x = 1");
    fs.writeFileSync(path.join(tmpDir, "App.java"), "class App {}");
    fs.writeFileSync(path.join(tmpDir, "main.rs"), "fn main() {}");
    fs.writeFileSync(path.join(tmpDir, "main.c"), "int main() {}");
    fs.writeFileSync(path.join(tmpDir, "lib.cpp"), "void foo() {}");
    fs.writeFileSync(path.join(tmpDir, "index.php"), "<?php echo 1;");
    fs.writeFileSync(path.join(tmpDir, "Main.kt"), "fun main() {}");
    fs.writeFileSync(path.join(tmpDir, "main.swift"), "print(1)");
    fs.writeFileSync(path.join(tmpDir, "Main.scala"), "object Main");
    fs.writeFileSync(path.join(tmpDir, "data.csv"), "a,b,c"); // should be ignored
    const files = await discoverFiles(tmpDir);
    assert.equal(files.length, 12);
  });
});
