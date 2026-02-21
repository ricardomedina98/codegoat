import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { captureOutput } from "../src/output/writer.js";

describe("captureOutput", () => {
  let tmpDir: string;
  afterEach(() => { if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it("returns no-op when no path specified", () => {
    const capture = captureOutput(undefined);
    capture.flush(); // should not throw
    capture.restore();
  });

  it("captures stdout writes to a file", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-writer-"));
    const outFile = path.join(tmpDir, "output.md");
    const capture = captureOutput(outFile);

    process.stdout.write("hello ");
    process.stdout.write("world\n");

    capture.flush();

    const content = fs.readFileSync(outFile, "utf-8");
    assert.equal(content, "hello world\n");
  });

  it("restores stdout after flush so writes reach stdout again", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-writer-"));
    const outFile = path.join(tmpDir, "output.md");

    const capture = captureOutput(outFile);
    process.stdout.write("captured");
    capture.flush();

    // After flush, stdout should work normally (not throw or capture)
    assert.ok(fs.existsSync(outFile));
  });

  it("creates parent directories", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-writer-"));
    const outFile = path.join(tmpDir, "nested", "dir", "output.json");
    const capture = captureOutput(outFile);

    process.stdout.write('{"ok":true}');
    capture.flush();

    assert.ok(fs.existsSync(outFile));
    assert.equal(fs.readFileSync(outFile, "utf-8"), '{"ok":true}');
  });

  it("restore works without flush (no file created)", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-writer-"));
    const outFile = path.join(tmpDir, "output.md");

    const capture = captureOutput(outFile);
    process.stdout.write("this should be captured");
    capture.restore();
    // File should not exist since we restored without flushing
    assert.ok(!fs.existsSync(outFile));
  });
});
