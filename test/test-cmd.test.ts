import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { detectFramework, resolveFramework, mapTestPath, isTestFile } from "../src/commands/test.js";
import type { TestFrameworkInfo } from "../src/commands/test.js";

// ── isTestFile ─────────────────────────────────────────────────────────

describe("isTestFile", () => {
  it("detects .test.ts files", () => {
    assert.ok(isTestFile("src/foo.test.ts"));
    assert.ok(isTestFile("foo.test.js"));
    assert.ok(isTestFile("bar.spec.tsx"));
  });

  it("detects _test.go and _test.py", () => {
    assert.ok(isTestFile("main_test.go"));
    assert.ok(isTestFile("utils_test.py"));
  });

  it("detects _spec.rb", () => {
    assert.ok(isTestFile("model_spec.rb"));
  });

  it("detects Test.java", () => {
    assert.ok(isTestFile("FooTest.java"));
  });

  it("detects test directories", () => {
    assert.ok(isTestFile("test/foo.ts"));
    assert.ok(isTestFile("tests/bar.py"));
    assert.ok(isTestFile("spec/baz.rb"));
    assert.ok(isTestFile("__tests__/qux.js"));
  });

  it("rejects regular source files", () => {
    assert.ok(!isTestFile("src/foo.ts"));
    assert.ok(!isTestFile("main.go"));
    assert.ok(!isTestFile("app.py"));
    assert.ok(!isTestFile("Foo.java"));
  });
});

// ── detectFramework ────────────────────────────────────────────────────

describe("detectFramework", () => {
  it("detects vitest from package.json", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cg-test-"));
    fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({
      devDependencies: { vitest: "^1.0.0" },
    }));
    const fw = detectFramework(tmp, ".ts");
    assert.equal(fw.name, "vitest");
    fs.rmSync(tmp, { recursive: true });
  });

  it("detects jest from package.json", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cg-test-"));
    fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({
      devDependencies: { jest: "^29.0.0" },
    }));
    const fw = detectFramework(tmp, ".ts");
    assert.equal(fw.name, "jest");
    fs.rmSync(tmp, { recursive: true });
  });

  it("detects node:test from scripts", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cg-test-"));
    fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({
      scripts: { test: "node --test test/*.test.ts" },
    }));
    const fw = detectFramework(tmp, ".ts");
    assert.equal(fw.name, "node");
    fs.rmSync(tmp, { recursive: true });
  });

  it("detects pytest from conftest.py", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cg-test-"));
    fs.writeFileSync(path.join(tmp, "conftest.py"), "");
    const fw = detectFramework(tmp, ".py");
    assert.equal(fw.name, "pytest");
    fs.rmSync(tmp, { recursive: true });
  });

  it("detects rspec from .rspec file", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cg-test-"));
    fs.writeFileSync(path.join(tmp, ".rspec"), "--format doc");
    const fw = detectFramework(tmp, ".rb");
    assert.equal(fw.name, "rspec");
    fs.rmSync(tmp, { recursive: true });
  });

  it("defaults to first candidate for Go", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cg-test-"));
    const fw = detectFramework(tmp, ".go");
    assert.equal(fw.name, "go-test");
    fs.rmSync(tmp, { recursive: true });
  });

  it("returns unknown for unrecognized extension", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cg-test-"));
    const fw = detectFramework(tmp, ".zig");
    assert.equal(fw.name, "unknown");
    fs.rmSync(tmp, { recursive: true });
  });
});

// ── resolveFramework ───────────────────────────────────────────────────

describe("resolveFramework", () => {
  it("resolves known framework by name", () => {
    const fw = resolveFramework("jest", ".ts");
    assert.ok(fw);
    assert.equal(fw!.name, "jest");
  });

  it("returns null for unknown name", () => {
    assert.equal(resolveFramework("nonexistent", ".ts"), null);
  });
});

// ── mapTestPath ────────────────────────────────────────────────────────

describe("mapTestPath", () => {
  const root = "/project";

  it("maps TS source to test dir", () => {
    const fw: TestFrameworkInfo = { name: "vitest", testDir: "test", testSuffix: ".test.ts", importStyle: "" };
    const result = mapTestPath("/project/src/utils.ts", fw, root);
    assert.equal(result, "/project/test/utils.test.ts");
  });

  it("maps Go source to same directory", () => {
    const fw: TestFrameworkInfo = { name: "go-test", testDir: "", testSuffix: "_test.go", importStyle: "" };
    const result = mapTestPath("/project/pkg/server.go", fw, root);
    assert.equal(result, "/project/pkg/server_test.go");
  });

  it("maps Python source to tests dir", () => {
    const fw: TestFrameworkInfo = { name: "pytest", testDir: "tests", testSuffix: "_test.py", importStyle: "" };
    const result = mapTestPath("/project/src/parser.py", fw, root);
    assert.equal(result, "/project/tests/parser_test.py");
  });

  it("maps Java main to test mirror", () => {
    const fw: TestFrameworkInfo = { name: "junit5", testDir: "src/test/java", testSuffix: "Test.java", importStyle: "" };
    const result = mapTestPath("/project/src/main/java/com/app/Foo.java", fw, root);
    assert.equal(result, "/project/src/test/java/com/app/FooTest.java");
  });

  it("maps Rust source to same file (inline tests)", () => {
    const fw: TestFrameworkInfo = { name: "cargo-test", testDir: "", testSuffix: "", importStyle: "" };
    const result = mapTestPath("/project/src/lib.rs", fw, root);
    assert.equal(result, "/project/src/lib.rs");
  });
});
