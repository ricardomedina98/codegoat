import fs from "node:fs";
import path from "node:path";
import { discoverFiles } from "../files/discover.js";
import { budgetFiles } from "../files/budget.js";
import { createProvider } from "../providers/factory.js";
import type { ChatMessage } from "../providers/types.js";
import { info, debug, warn, error as logError, classifyError, EXIT_CONFIG_ERROR } from "../output/logger.js";

// ── Types ──────────────────────────────────────────────────────────────

export interface TestOptions {
  provider?: string;
  model?: string;
  budget?: number;
  framework?: string;
  dryRun?: boolean;
  format?: "markdown" | "json";
  noIgnore?: boolean;
  rules?: string[];
}

export interface TestFrameworkInfo {
  name: string;
  testDir: string;        // conventional test directory
  testSuffix: string;     // e.g. ".test.ts"
  importStyle: string;    // brief example for the LLM
}

interface GeneratedTest {
  sourceFile: string;
  testFile: string;
  content: string;
  framework: string;
  isNew: boolean;
}

// ── Framework detection ────────────────────────────────────────────────

const LANG_FRAMEWORKS: Record<string, TestFrameworkInfo[]> = {
  ".ts": [
    { name: "vitest",  testDir: "test", testSuffix: ".test.ts",  importStyle: "import { describe, it, expect } from 'vitest'" },
    { name: "jest",    testDir: "__tests__", testSuffix: ".test.ts",  importStyle: "import { describe, it, expect } from '@jest/globals'" },
    { name: "mocha",   testDir: "test", testSuffix: ".test.ts",  importStyle: "import { describe, it } from 'mocha'; import assert from 'node:assert'" },
    { name: "node",    testDir: "test", testSuffix: ".test.ts",  importStyle: "import { describe, it } from 'node:test'; import assert from 'node:assert/strict'" },
  ],
  ".js": [
    { name: "vitest",  testDir: "test", testSuffix: ".test.js",  importStyle: "import { describe, it, expect } from 'vitest'" },
    { name: "jest",    testDir: "__tests__", testSuffix: ".test.js",  importStyle: "const { describe, it, expect } = require('@jest/globals')" },
    { name: "mocha",   testDir: "test", testSuffix: ".test.js",  importStyle: "const { describe, it } = require('mocha'); const assert = require('assert')" },
    { name: "node",    testDir: "test", testSuffix: ".test.js",  importStyle: "const { describe, it } = require('node:test'); const assert = require('node:assert/strict')" },
  ],
  ".py": [
    { name: "pytest",   testDir: "tests", testSuffix: "_test.py",  importStyle: "import pytest" },
    { name: "unittest", testDir: "tests", testSuffix: "_test.py",  importStyle: "import unittest" },
  ],
  ".go": [
    { name: "go-test",  testDir: "",    testSuffix: "_test.go",  importStyle: 'import "testing"' },
  ],
  ".rb": [
    { name: "rspec",    testDir: "spec", testSuffix: "_spec.rb",  importStyle: "require 'rspec'" },
    { name: "minitest", testDir: "test", testSuffix: "_test.rb",  importStyle: "require 'minitest/autorun'" },
  ],
  ".java": [
    { name: "junit5",   testDir: "src/test/java", testSuffix: "Test.java", importStyle: "import org.junit.jupiter.api.Test; import static org.junit.jupiter.api.Assertions.*;" },
    { name: "junit4",   testDir: "src/test/java", testSuffix: "Test.java", importStyle: "import org.junit.Test; import static org.junit.Assert.*;" },
  ],
  ".rs": [
    { name: "cargo-test", testDir: "", testSuffix: "", importStyle: "#[cfg(test)] mod tests { use super::*; #[test] fn test_foo() {} }" },
  ],
  ".c": [
    { name: "cunit", testDir: "test", testSuffix: "_test.c", importStyle: '#include <CUnit/CUnit.h>\n#include <CUnit/Basic.h>' },
    { name: "cmocka", testDir: "test", testSuffix: "_test.c", importStyle: '#include <stdarg.h>\n#include <setjmp.h>\n#include <cmocka.h>' },
  ],
  ".h": [
    { name: "cunit", testDir: "test", testSuffix: "_test.c", importStyle: '#include <CUnit/CUnit.h>\n#include <CUnit/Basic.h>' },
  ],
  ".cpp": [
    { name: "gtest", testDir: "test", testSuffix: "_test.cpp", importStyle: '#include <gtest/gtest.h>' },
    { name: "catch2", testDir: "test", testSuffix: "_test.cpp", importStyle: '#include <catch2/catch_test_macros.hpp>' },
  ],
  ".hpp": [
    { name: "gtest", testDir: "test", testSuffix: "_test.cpp", importStyle: '#include <gtest/gtest.h>' },
  ],
  ".cc": [
    { name: "gtest", testDir: "test", testSuffix: "_test.cc", importStyle: '#include <gtest/gtest.h>' },
  ],
  ".php": [
    { name: "phpunit", testDir: "tests", testSuffix: "Test.php", importStyle: 'use PHPUnit\\Framework\\TestCase;' },
    { name: "pest", testDir: "tests", testSuffix: "Test.php", importStyle: "use function Pest\\test;" },
  ],
  ".kt": [
    { name: "junit5", testDir: "src/test/kotlin", testSuffix: "Test.kt", importStyle: "import org.junit.jupiter.api.Test\nimport org.junit.jupiter.api.Assertions.*" },
    { name: "kotest", testDir: "src/test/kotlin", testSuffix: "Test.kt", importStyle: "import io.kotest.core.spec.style.StringSpec\nimport io.kotest.matchers.shouldBe" },
  ],
  ".swift": [
    { name: "xctest", testDir: "Tests", testSuffix: "Tests.swift", importStyle: "import XCTest\n@testable import App" },
  ],
  ".scala": [
    { name: "scalatest", testDir: "src/test/scala", testSuffix: "Spec.scala", importStyle: 'import org.scalatest.flatspec.AnyFlatSpec\nimport org.scalatest.matchers.should.Matchers' },
    { name: "munit", testDir: "src/test/scala", testSuffix: "Suite.scala", importStyle: "import munit.FunSuite" },
  ],
};

/** Detect framework from project files */
export function detectFramework(rootDir: string, ext: string): TestFrameworkInfo {
  const candidates = LANG_FRAMEWORKS[ext];
  if (!candidates || candidates.length === 0) {
    return { name: "unknown", testDir: "test", testSuffix: ".test" + ext, importStyle: "" };
  }

  // Check package.json for JS/TS
  if (ext === ".ts" || ext === ".js") {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf-8"));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (allDeps["vitest"]) return candidates.find(c => c.name === "vitest")!;
      if (allDeps["jest"] || allDeps["ts-jest"]) return candidates.find(c => c.name === "jest")!;
      if (allDeps["mocha"]) return candidates.find(c => c.name === "mocha")!;
      // Check scripts for node:test pattern
      const scripts = JSON.stringify(pkg.scripts ?? {});
      if (scripts.includes("node --test") || scripts.includes("node:test")) {
        return candidates.find(c => c.name === "node")!;
      }
    } catch {}
  }

  // Check for pytest
  if (ext === ".py") {
    if (fs.existsSync(path.join(rootDir, "pytest.ini")) ||
        fs.existsSync(path.join(rootDir, "pyproject.toml")) ||
        fs.existsSync(path.join(rootDir, "conftest.py"))) {
      return candidates.find(c => c.name === "pytest")!;
    }
  }

  // Check for RSpec
  if (ext === ".rb") {
    if (fs.existsSync(path.join(rootDir, ".rspec")) ||
        fs.existsSync(path.join(rootDir, "spec"))) {
      return candidates.find(c => c.name === "rspec")!;
    }
  }

  // Check for PHPUnit/Pest
  if (ext === ".php") {
    try {
      const composer = JSON.parse(fs.readFileSync(path.join(rootDir, "composer.json"), "utf-8"));
      const allDeps = { ...composer.require, ...composer["require-dev"] };
      if (allDeps["pestphp/pest"]) return candidates.find(c => c.name === "pest")!;
    } catch {}
    if (fs.existsSync(path.join(rootDir, "phpunit.xml")) || fs.existsSync(path.join(rootDir, "phpunit.xml.dist"))) {
      return candidates.find(c => c.name === "phpunit")!;
    }
  }

  // Check for CMake/GTest for C++
  if (ext === ".cpp" || ext === ".cc" || ext === ".hpp") {
    if (fs.existsSync(path.join(rootDir, "CMakeLists.txt"))) {
      try {
        const cmake = fs.readFileSync(path.join(rootDir, "CMakeLists.txt"), "utf-8");
        if (cmake.includes("Catch2")) return candidates.find(c => c.name === "catch2") ?? candidates[0];
      } catch {}
    }
  }

  // Check for JUnit 5 vs 4
  if (ext === ".java") {
    if (fs.existsSync(path.join(rootDir, "build.gradle")) || fs.existsSync(path.join(rootDir, "build.gradle.kts"))) {
      return candidates.find(c => c.name === "junit5")!;
    }
  }

  // Default to first candidate
  return candidates[0];
}

/** Resolve explicit --framework name to a TestFrameworkInfo */
export function resolveFramework(name: string, ext: string): TestFrameworkInfo | null {
  const candidates = LANG_FRAMEWORKS[ext] ?? [];
  return candidates.find(c => c.name === name) ?? null;
}

// ── Test file path mapping ─────────────────────────────────────────────

export function mapTestPath(sourceFile: string, framework: TestFrameworkInfo, rootDir: string): string {
  const rel = path.relative(rootDir, sourceFile);
  const parsed = path.parse(rel);
  const ext = parsed.ext;

  // Go/Rust: tests live alongside source
  if (ext === ".go") {
    return path.join(rootDir, parsed.dir, parsed.name + framework.testSuffix);
  }
  if (ext === ".rs") {
    // Rust uses inline #[cfg(test)] — return same file path as a signal
    return sourceFile;
  }
  // Java: mirror src/main/java → src/test/java
  if (ext === ".java") {
    const javaPath = rel.replace(/^src\/main\/java\//, "");
    return path.join(rootDir, framework.testDir, path.dirname(javaPath), parsed.name + framework.testSuffix);
  }

  // PHP: tests/FooTest.php (PascalCase convention)
  if (ext === ".php") {
    const stripped = rel.replace(/^src\//, "");
    const dir = path.dirname(stripped);
    return path.join(rootDir, framework.testDir, dir, parsed.name + framework.testSuffix);
  }

  // C/C++: test/name_test.c(pp)
  if ([".c", ".h", ".cpp", ".hpp", ".cc"].includes(ext)) {
    const stripped = rel.replace(/^src\//, "");
    const dir = path.dirname(stripped);
    return path.join(rootDir, framework.testDir, dir, parsed.name + framework.testSuffix);
  }

  // JS/TS/Python/Ruby: testDir/name.test.ext
  // Strip leading src/ if present
  const stripped = rel.replace(/^src\//, "");
  const dir = path.dirname(stripped);
  return path.join(rootDir, framework.testDir, dir, parsed.name + framework.testSuffix);
}

// ── LLM Prompt ─────────────────────────────────────────────────────────

const TEST_SYSTEM_PROMPT =
  "You are an expert test engineer. Generate comprehensive unit tests for the provided source code. " +
  "Use the specified testing framework and follow its conventions. " +
  "Test each exported/public function with: happy path, edge cases, and error cases. " +
  "Use descriptive test names. Do NOT include explanations — output ONLY the test file content. " +
  "Do not wrap the output in markdown code fences.";

function buildTestPrompt(
  sourceFile: string,
  sourceContent: string,
  framework: TestFrameworkInfo,
  existingTests: string | null,
  rules?: string[]
): ChatMessage[] {
  let userContent = `Generate unit tests for this source file using ${framework.name}.\n\n`;
  userContent += `Framework import style: ${framework.importStyle}\n\n`;
  userContent += `=== ${sourceFile} ===\n${sourceContent}\n\n`;

  if (existingTests) {
    userContent += `=== Existing tests (append new tests, do not duplicate) ===\n${existingTests}\n\n`;
  }

  userContent += "Generate a complete test file. Test every exported/public function. " +
    "Include happy path, edge cases, and error handling tests. " +
    "Output ONLY the raw test file content, no markdown fences.";

  if (rules && rules.length > 0) {
    userContent += "\n\nProject-specific rules:\n" + rules.map((r, i) => `${i + 1}. ${r}`).join("\n");
  }

  return [
    { role: "system", content: TEST_SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];
}

// ── Main command ───────────────────────────────────────────────────────

export async function runTest(targetPath: string, opts: TestOptions): Promise<void> {
  const resolved = path.resolve(targetPath);

  // Discover source files (exclude test files)
  const files = await discoverFiles(resolved, { noIgnore: opts.noIgnore });
  const sourceFiles = files.filter(f => !isTestFile(f.path));

  if (sourceFiles.length === 0) {
    warn("No source files found to generate tests for.");
    return;
  }

  const { included: budgeted } = budgetFiles(sourceFiles, opts.budget ?? 100_000);
  info(`Generating tests for ${budgeted.length} file${budgeted.length !== 1 ? "s" : ""}...`);

  // Group by extension for framework detection
  const rootDir = fs.statSync(resolved).isDirectory() ? resolved : path.dirname(resolved);
  const results: GeneratedTest[] = [];

  let provider: ReturnType<typeof createProvider>;
  try {
    provider = createProvider(opts.provider ?? "openai", opts.model);
  } catch (e: any) {
    logError(e.message);
    process.exit(EXIT_CONFIG_ERROR);
  }

  for (const file of budgeted) {
    const ext = path.extname(file.path);
    const fullSourcePath = path.isAbsolute(file.path) ? file.path : path.join(rootDir, file.path);

    // Detect or resolve framework
    let framework: TestFrameworkInfo;
    if (opts.framework) {
      const resolved = resolveFramework(opts.framework, ext);
      if (!resolved) {
        debug(`Framework '${opts.framework}' not recognized for ${ext}, using auto-detect`);
        framework = detectFramework(rootDir, ext);
      } else {
        framework = resolved;
      }
    } else {
      framework = detectFramework(rootDir, ext);
    }

    const testPath = mapTestPath(fullSourcePath, framework, rootDir);
    const existingTests = fs.existsSync(testPath) ? fs.readFileSync(testPath, "utf-8") : null;
    const isNew = !existingTests;

    debug(`${file.path} → ${path.relative(rootDir, testPath)} (${framework.name})`);

    const messages = buildTestPrompt(file.path, file.content, framework, existingTests, opts.rules);

    // Stream LLM response
    let output = "";
    const stream = provider.chat(messages);
    for await (const chunk of stream) {
      output += chunk;
    }

    // Strip markdown fences if LLM added them anyway
    output = stripCodeFences(output);

    results.push({
      sourceFile: file.path,
      testFile: path.relative(rootDir, testPath),
      content: output,
      framework: framework.name,
      isNew,
    });
  }

  // Output results
  if (opts.format === "json") {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  for (const result of results) {
    const label = result.isNew ? "NEW" : "UPDATE";
    console.log(`\n\x1b[1m\x1b[36m[${label}]\x1b[0m \x1b[33m${result.testFile}\x1b[0m (${result.framework})`);
    console.log(`  Source: ${result.sourceFile}`);

    if (opts.dryRun) {
      console.log("\x1b[2m--- dry run: preview only ---\x1b[0m");
      console.log(result.content);
      continue;
    }

    // Write test file
    const absTestPath = path.join(rootDir, result.testFile);
    fs.mkdirSync(path.dirname(absTestPath), { recursive: true });
    fs.writeFileSync(absTestPath, result.content, "utf-8");
    console.log(`  ✅ Written to ${result.testFile}`);
  }

  info(`\nGenerated ${results.length} test file${results.length !== 1 ? "s" : ""}.`);
}

// ── Helpers ────────────────────────────────────────────────────────────

const TEST_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /_test\.(go|py|rb)$/,
  /_spec\.rb$/,
  /Test\.java$/,
  /^test[_/]/,
  /^tests[_/]/,
  /^spec[_/]/,
  /__tests__\//,
];

export function isTestFile(filePath: string): boolean {
  return TEST_PATTERNS.some(p => p.test(filePath));
}

function stripCodeFences(text: string): string {
  // Remove leading ```lang and trailing ```
  return text.replace(/^```\w*\n?/, "").replace(/\n?```\s*$/, "").trim() + "\n";
}
