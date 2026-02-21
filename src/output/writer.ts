import fs from "node:fs";
import path from "node:path";

/**
 * When an output path is specified, intercepts process.stdout.write
 * to capture all output to a buffer, then writes to file on flush.
 * Progress/status still goes to stderr (info/debug/warn use stderr).
 */
export interface OutputCapture {
  flush(): void;
  restore(): void;
}

export function captureOutput(outputPath?: string): OutputCapture {
  if (!outputPath) {
    return { flush: () => {}, restore: () => {} };
  }

  const buffer: string[] = [];
  const originalWrite = process.stdout.write.bind(process.stdout);

  process.stdout.write = ((chunk: any, ...args: any[]): boolean => {
    buffer.push(typeof chunk === "string" ? chunk : chunk.toString());
    return true;
  }) as any;

  return {
    flush() {
      const resolved = path.resolve(outputPath);
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(resolved, buffer.join(""), "utf-8");
      // Restore and print confirmation to stderr
      process.stdout.write = originalWrite;
      process.stderr.write(`\nWritten to ${resolved}\n`);
    },
    restore() {
      process.stdout.write = originalWrite;
    },
  };
}
