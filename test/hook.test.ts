import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { generateHookScript, isCodegoatHook, installHook, uninstallHook } from "../src/commands/hook.js";

describe("generateHookScript", () => {
  it("generates a valid shell script with defaults", () => {
    const script = generateHookScript();
    assert.ok(script.startsWith("#!/bin/sh"));
    assert.ok(script.includes("# codegoat pre-commit hook"));
    assert.ok(script.includes("--fail-on warning"));
    assert.ok(script.includes("--severity info"));
    assert.ok(script.includes("--quiet"));
    assert.ok(script.includes("--diff"));
  });

  it("respects custom failOn and severity", () => {
    const script = generateHookScript({ failOn: "critical", severity: "warning" });
    assert.ok(script.includes("--fail-on critical"));
    assert.ok(script.includes("--severity warning"));
  });

  it("includes fast path for no staged files", () => {
    const script = generateHookScript();
    assert.ok(script.includes("git diff --cached --name-only"));
    assert.ok(script.includes("HAS_SUPPORTED=false"));
  });

  it("checks for supported extensions", () => {
    const script = generateHookScript();
    assert.ok(script.includes("*.ts|"));
    assert.ok(script.includes("*.py|"));
    assert.ok(script.includes("*.go|"));
    assert.ok(script.includes("*.php|"));
    assert.ok(script.includes("*.scala)"));
  });
});

describe("isCodegoatHook", () => {
  let tmpDir: string;
  afterEach(() => { if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it("returns false for non-existent file", () => {
    assert.equal(isCodegoatHook("/nonexistent/path"), false);
  });

  it("returns true for codegoat-generated hook", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-hook-"));
    const hookFile = path.join(tmpDir, "pre-commit");
    fs.writeFileSync(hookFile, generateHookScript());
    assert.equal(isCodegoatHook(hookFile), true);
  });

  it("returns false for non-codegoat hook", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-hook-"));
    const hookFile = path.join(tmpDir, "pre-commit");
    fs.writeFileSync(hookFile, "#!/bin/sh\necho 'custom hook'\n");
    assert.equal(isCodegoatHook(hookFile), false);
  });
});

describe("installHook + uninstallHook (git repo)", () => {
  let tmpDir: string;
  afterEach(() => { if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it("installs and uninstalls in a git repo", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-hook-"));
    execSync("git init", { cwd: tmpDir, stdio: "pipe" });

    // Save and change cwd
    const origCwd = process.cwd();
    process.chdir(tmpDir);

    try {
      const installResult = installHook({ failOn: "critical" });
      assert.ok(installResult.installed, installResult.message);

      const hookPath = path.join(tmpDir, ".git", "hooks", "pre-commit");
      assert.ok(fs.existsSync(hookPath));
      const content = fs.readFileSync(hookPath, "utf-8");
      assert.ok(content.includes("--fail-on critical"));

      // Check it's executable
      const stat = fs.statSync(hookPath);
      assert.ok(stat.mode & 0o100, "hook should be executable");

      // Reinstall should work (overwrites codegoat hook)
      const reinstall = installHook();
      assert.ok(reinstall.installed);

      // Uninstall
      const uninstallResult = uninstallHook();
      assert.ok(uninstallResult.removed, uninstallResult.message);
      assert.ok(!fs.existsSync(hookPath));
    } finally {
      process.chdir(origCwd);
    }
  });

  it("refuses to overwrite non-codegoat hook", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-hook-"));
    execSync("git init", { cwd: tmpDir, stdio: "pipe" });
    const hookPath = path.join(tmpDir, ".git", "hooks", "pre-commit");
    fs.mkdirSync(path.dirname(hookPath), { recursive: true });
    fs.writeFileSync(hookPath, "#!/bin/sh\necho custom\n");

    const origCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      const result = installHook();
      assert.ok(!result.installed);
      assert.ok(result.message.includes("already exists"));
    } finally {
      process.chdir(origCwd);
    }
  });

  it("refuses to uninstall non-codegoat hook", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-hook-"));
    execSync("git init", { cwd: tmpDir, stdio: "pipe" });
    const hookPath = path.join(tmpDir, ".git", "hooks", "pre-commit");
    fs.mkdirSync(path.dirname(hookPath), { recursive: true });
    fs.writeFileSync(hookPath, "#!/bin/sh\necho custom\n");

    const origCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      const result = uninstallHook();
      assert.ok(!result.removed);
      assert.ok(result.message.includes("not installed by codegoat"));
    } finally {
      process.chdir(origCwd);
    }
  });

  it("detects husky directory", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-hook-"));
    execSync("git init", { cwd: tmpDir, stdio: "pipe" });
    fs.mkdirSync(path.join(tmpDir, ".husky"), { recursive: true });

    const origCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      const result = installHook();
      assert.ok(result.installed);
      assert.ok(fs.existsSync(path.join(tmpDir, ".husky", "pre-commit")));
    } finally {
      process.chdir(origCwd);
    }
  });
});
