import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { walkUpConfigs, mergeConfigs, isPackageBoundary, detectPackages } from "../src/config.js";

describe("walkUpConfigs", () => {
  let tmpDir: string;
  afterEach(() => { if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it("finds configs from target to root", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-mono-"));
    // Simulate repo root
    fs.mkdirSync(path.join(tmpDir, ".git"));
    fs.writeFileSync(path.join(tmpDir, ".codegoatrc"), JSON.stringify({ provider: "openai", rules: ["root rule"] }));
    // Child package
    fs.mkdirSync(path.join(tmpDir, "packages", "api"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "packages", "api", ".codegoatrc"), JSON.stringify({ model: "gpt-4", rules: ["api rule"] }));

    const configs = walkUpConfigs(path.join(tmpDir, "packages", "api"), tmpDir);
    assert.equal(configs.length, 2);
    assert.equal(configs[0].provider, "openai"); // root first
    assert.equal(configs[1].model, "gpt-4"); // child second
  });

  it("returns empty when no configs found", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-mono-"));
    fs.mkdirSync(path.join(tmpDir, ".git"));
    const configs = walkUpConfigs(tmpDir, tmpDir);
    assert.equal(configs.length, 0);
  });
});

describe("mergeConfigs", () => {
  it("child scalar values override parent", () => {
    const result = mergeConfigs([
      { provider: "openai", model: "gpt-4o-mini", budget: 100000 },
      { model: "gpt-4", budget: 50000 },
    ]);
    assert.equal(result.provider, "openai"); // inherited from parent
    assert.equal(result.model, "gpt-4"); // overridden by child
    assert.equal(result.budget, 50000); // overridden by child
  });

  it("concatenates rules from all configs", () => {
    const result = mergeConfigs([
      { rules: ["root rule 1", "root rule 2"] },
      { rules: ["child rule"] },
    ]);
    assert.deepEqual(result.rules, ["root rule 1", "root rule 2", "child rule"]);
  });

  it("handles empty configs", () => {
    const result = mergeConfigs([{}, {}]);
    assert.equal(result.provider, undefined);
    assert.equal(result.rules, undefined);
  });

  it("single config passes through", () => {
    const result = mergeConfigs([{ provider: "anthropic", rules: ["r1"] }]);
    assert.equal(result.provider, "anthropic");
    assert.deepEqual(result.rules, ["r1"]);
  });
});

describe("isPackageBoundary", () => {
  let tmpDir: string;
  afterEach(() => { if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it("detects package.json", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-pkg-"));
    fs.writeFileSync(path.join(tmpDir, "package.json"), "{}");
    assert.equal(isPackageBoundary(tmpDir), true);
  });

  it("detects Cargo.toml", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-pkg-"));
    fs.writeFileSync(path.join(tmpDir, "Cargo.toml"), "[package]");
    assert.equal(isPackageBoundary(tmpDir), true);
  });

  it("detects go.mod", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-pkg-"));
    fs.writeFileSync(path.join(tmpDir, "go.mod"), "module x");
    assert.equal(isPackageBoundary(tmpDir), true);
  });

  it("detects .codegoatrc", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-pkg-"));
    fs.writeFileSync(path.join(tmpDir, ".codegoatrc"), "{}");
    assert.equal(isPackageBoundary(tmpDir), true);
  });

  it("returns false for empty dir", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-pkg-"));
    assert.equal(isPackageBoundary(tmpDir), false);
  });
});

describe("detectPackages", () => {
  let tmpDir: string;
  afterEach(() => { if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it("finds top-level packages", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-pkg-"));
    fs.mkdirSync(path.join(tmpDir, "frontend"));
    fs.writeFileSync(path.join(tmpDir, "frontend", "package.json"), "{}");
    fs.mkdirSync(path.join(tmpDir, "backend"));
    fs.writeFileSync(path.join(tmpDir, "backend", "go.mod"), "module x");
    fs.mkdirSync(path.join(tmpDir, "docs")); // not a package

    const pkgs = detectPackages(tmpDir);
    assert.ok(pkgs.includes("frontend"));
    assert.ok(pkgs.includes("backend"));
    assert.ok(!pkgs.includes("docs"));
  });

  it("finds nested packages (packages/api pattern)", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-pkg-"));
    fs.mkdirSync(path.join(tmpDir, "packages", "api"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "packages", "api", "package.json"), "{}");
    fs.mkdirSync(path.join(tmpDir, "packages", "web"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "packages", "web", "package.json"), "{}");

    const pkgs = detectPackages(tmpDir);
    assert.ok(pkgs.includes("packages/api"));
    assert.ok(pkgs.includes("packages/web"));
  });
});
