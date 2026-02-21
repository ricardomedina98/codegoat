import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { budgetFiles } from "../src/files/budget.js";
import type { DiscoveredFile } from "../src/files/discover.js";

function makeFile(name: string, size: number): DiscoveredFile {
  const content = "a".repeat(size);
  return { path: name, content, sizeBytes: size };
}

describe("budgetFiles", () => {
  it("returns all files when under budget", () => {
    const files = [makeFile("a.ts", 100), makeFile("b.ts", 200)];
    const result = budgetFiles(files, 100_000);

    assert.equal(result.included.length, 2);
    assert.equal(result.skipped.length, 0);
    // 100 chars / 4 = 25 tokens, 200 chars / 4 = 50 tokens → 75 total
    assert.equal(result.totalTokens, 75);
  });

  it("sorts files by size ascending (smaller first)", () => {
    const files = [makeFile("big.ts", 400), makeFile("small.ts", 100), makeFile("med.ts", 200)];
    const result = budgetFiles(files, 100_000);

    assert.equal(result.included[0].path, "small.ts");
    assert.equal(result.included[1].path, "med.ts");
    assert.equal(result.included[2].path, "big.ts");
  });

  it("skips files that exceed the remaining budget", () => {
    // 40 chars → 10 tokens, 400 chars → 100 tokens
    const files = [makeFile("small.ts", 40), makeFile("large.ts", 400)];
    const result = budgetFiles(files, 50);

    assert.equal(result.included.length, 1);
    assert.equal(result.included[0].path, "small.ts");
    assert.equal(result.skipped.length, 1);
    assert.equal(result.skipped[0].path, "large.ts");
    assert.equal(result.totalTokens, 10);
  });

  it("handles empty input", () => {
    const result = budgetFiles([], 100_000);

    assert.equal(result.included.length, 0);
    assert.equal(result.skipped.length, 0);
    assert.equal(result.totalTokens, 0);
  });

  it("handles single file over budget", () => {
    const files = [makeFile("huge.ts", 1_000_000)];
    const result = budgetFiles(files, 100);

    assert.equal(result.included.length, 0);
    assert.equal(result.skipped.length, 1);
    assert.equal(result.totalTokens, 0);
  });

  it("handles exact fit", () => {
    // 400 chars → 100 tokens exactly
    const files = [makeFile("exact.ts", 400)];
    const result = budgetFiles(files, 100);

    assert.equal(result.included.length, 1);
    assert.equal(result.skipped.length, 0);
    assert.equal(result.totalTokens, 100);
  });

  it("uses default budget of 100_000 tokens", () => {
    // 400_000 chars → 100_000 tokens = default budget
    const files = [makeFile("fits.ts", 400_000)];
    const result = budgetFiles(files);

    assert.equal(result.included.length, 1);
    assert.equal(result.totalTokens, 100_000);
  });

  it("does not mutate the input array", () => {
    const files = [makeFile("b.ts", 200), makeFile("a.ts", 100)];
    const originalOrder = files.map((f) => f.path);
    budgetFiles(files, 100_000);

    assert.deepEqual(
      files.map((f) => f.path),
      originalOrder
    );
  });

  it("packs greedily — includes as many small files as possible", () => {
    // Budget: 10 tokens = 40 chars
    // 5 files of 8 chars each → 2 tokens each → 5 fit exactly into 10
    const files = Array.from({ length: 7 }, (_, i) =>
      makeFile(`f${i}.ts`, 8)
    );
    const result = budgetFiles(files, 10);

    assert.equal(result.included.length, 5);
    assert.equal(result.skipped.length, 2);
    assert.equal(result.totalTokens, 10);
  });

  it("handles token rounding with Math.ceil", () => {
    // 1 char → Math.ceil(1/4) = 1 token
    // 3 chars → Math.ceil(3/4) = 1 token
    // 5 chars → Math.ceil(5/4) = 2 tokens
    const files = [makeFile("one.ts", 1), makeFile("three.ts", 3), makeFile("five.ts", 5)];
    const result = budgetFiles(files, 3);

    // 1 + 1 + 2 = 4 tokens > 3 budget, so five.ts should be skipped
    assert.equal(result.included.length, 2);
    assert.equal(result.skipped.length, 1);
    assert.equal(result.skipped[0].path, "five.ts");
    assert.equal(result.totalTokens, 2); // 1 + 1
  });
});
