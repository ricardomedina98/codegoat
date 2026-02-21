import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadConfig, applyConfig, generateStarterConfig } from "../src/config.js";

describe("loadConfig", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty config when no files exist", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-cfg-"));
    const config = loadConfig(tmpDir);
    assert.deepEqual(config, {});
  });

  it("loads config from cwd", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-cfg-"));
    fs.writeFileSync(
      path.join(tmpDir, ".codegoatrc"),
      JSON.stringify({ provider: "ollama", model: "codellama" })
    );
    const config = loadConfig(tmpDir);
    assert.equal(config.provider, "ollama");
    assert.equal(config.model, "codellama");
  });

  it("handles invalid JSON gracefully", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-cfg-"));
    fs.writeFileSync(path.join(tmpDir, ".codegoatrc"), "not json{{{");
    const config = loadConfig(tmpDir);
    assert.deepEqual(config, {});
  });
});

describe("applyConfig", () => {
  const savedEnv: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  });

  function saveEnv(key: string) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }

  it("sets env vars from config when not already set", () => {
    saveEnv("CODEGOAT_PROVIDER");
    saveEnv("CODEGOAT_MODEL");
    applyConfig({}, { provider: "anthropic", model: "claude-3-haiku-20240307" });
    assert.equal(process.env.CODEGOAT_PROVIDER, "anthropic");
    assert.equal(process.env.CODEGOAT_MODEL, "claude-3-haiku-20240307");
  });

  it("does not override existing env vars", () => {
    saveEnv("CODEGOAT_PROVIDER");
    process.env.CODEGOAT_PROVIDER = "openai";
    applyConfig({}, { provider: "anthropic" });
    assert.equal(process.env.CODEGOAT_PROVIDER, "openai");
  });

  it("does not override CLI flags", () => {
    saveEnv("CODEGOAT_PROVIDER");
    applyConfig({ provider: "openai" }, { provider: "anthropic" });
    assert.equal(process.env.CODEGOAT_PROVIDER, undefined);
  });
});

describe("generateStarterConfig", () => {
  it("produces valid JSON", () => {
    const content = generateStarterConfig();
    const parsed = JSON.parse(content);
    assert.equal(parsed.provider, "openai");
    assert.equal(parsed.model, "gpt-4o-mini");
    assert.equal(parsed.budget, 100000);
  });
});
