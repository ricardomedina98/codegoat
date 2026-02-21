import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createDebouncer } from "../src/commands/watch.js";

describe("createDebouncer", () => {
  it("batches rapid pushes into a single flush", async () => {
    const debouncer = createDebouncer(50);
    let flushed: string[][] = [];
    debouncer.onFlush((files) => { flushed.push(files); });

    debouncer.push("/a.ts");
    debouncer.push("/b.ts");
    debouncer.push("/c.ts");

    await new Promise(r => setTimeout(r, 100));
    assert.equal(flushed.length, 1);
    assert.deepEqual(flushed[0].sort(), ["/a.ts", "/b.ts", "/c.ts"]);
    debouncer.destroy();
  });

  it("deduplicates same file pushed multiple times", async () => {
    const debouncer = createDebouncer(50);
    let flushed: string[][] = [];
    debouncer.onFlush((files) => { flushed.push(files); });

    debouncer.push("/a.ts");
    debouncer.push("/a.ts");
    debouncer.push("/a.ts");

    await new Promise(r => setTimeout(r, 100));
    assert.equal(flushed.length, 1);
    assert.deepEqual(flushed[0], ["/a.ts"]);
    debouncer.destroy();
  });

  it("flushes separately when gap exceeds debounce time", async () => {
    const debouncer = createDebouncer(30);
    let flushed: string[][] = [];
    debouncer.onFlush((files) => { flushed.push(files); });

    debouncer.push("/a.ts");
    await new Promise(r => setTimeout(r, 60));
    debouncer.push("/b.ts");
    await new Promise(r => setTimeout(r, 60));

    assert.equal(flushed.length, 2);
    assert.deepEqual(flushed[0], ["/a.ts"]);
    assert.deepEqual(flushed[1], ["/b.ts"]);
    debouncer.destroy();
  });

  it("does not flush after destroy", async () => {
    const debouncer = createDebouncer(50);
    let flushed: string[][] = [];
    debouncer.onFlush((files) => { flushed.push(files); });

    debouncer.push("/a.ts");
    debouncer.destroy();

    await new Promise(r => setTimeout(r, 100));
    assert.equal(flushed.length, 0);
  });
});
